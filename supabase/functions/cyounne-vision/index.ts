// Cyounne Vision — Lovable AI (Gemini) → Gemini direct → HuggingFace. Cascade forcée, journal interne.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function clean(t: string): string {
  return (t ?? "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\bMr\.?\s*EKEKE\b/gi, "Monsieur ÉKÉKÉ")
    .replace(/\bMarcy-B\s+EKEKE\b/gi, "Monsieur ÉKÉKÉ");
}

const PROMPT_DEFAULT = "Analyse cette image en détail en français. Si tu détectes du texte, fais l'OCR. Si tu détectes une personne, un logo ou un objet, décris-le précisément. Texte naturel, pas de markdown.";

// Internal log (non visible to user) — persisted to audit_log via service role.
async function logProvider(entry: {
  kind: "vision" | "doc";
  provider: string;
  status: "success" | "fail" | "timeout";
  durationMs: number;
  detail?: string;
}) {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    await fetch(`${url}/rest/v1/audit_log`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        action: `cyounne_${entry.kind}_provider`,
        target: entry.provider,
        details: { status: entry.status, durationMs: entry.durationMs, detail: entry.detail ?? null, ts: new Date().toISOString() },
      }),
    });
  } catch (_) { /* silent */ }
  console.log(`[provider-log] kind=${entry.kind} provider=${entry.provider} status=${entry.status} ms=${entry.durationMs}${entry.detail ? " detail=" + entry.detail : ""}`);
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

async function tryLovableAI(imageBase64: string, mimeType: string, prompt: string): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  const t0 = Date.now();
  if (!key) { await logProvider({ kind: "vision", provider: "lovable", status: "fail", durationMs: 0, detail: "no key" }); return null; }
  try {
    const res = await withTimeout(fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        }],
      }),
    }), 20000);
    if (!res.ok) { await logProvider({ kind: "vision", provider: "lovable", status: "fail", durationMs: Date.now() - t0, detail: `http ${res.status}` }); return null; }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) { await logProvider({ kind: "vision", provider: "lovable", status: "fail", durationMs: Date.now() - t0, detail: "empty" }); return null; }
    await logProvider({ kind: "vision", provider: "lovable", status: "success", durationMs: Date.now() - t0 });
    return clean(text);
  } catch (e) {
    const msg = (e as Error).message;
    await logProvider({ kind: "vision", provider: "lovable", status: msg === "timeout" ? "timeout" : "fail", durationMs: Date.now() - t0, detail: msg });
    return null;
  }
}

async function tryGeminiDirect(imageBase64: string, mimeType: string, prompt: string): Promise<string | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  const t0 = Date.now();
  if (!key) { await logProvider({ kind: "vision", provider: "gemini", status: "fail", durationMs: 0, detail: "no key" }); return null; }
  try {
    const res = await withTimeout(fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        }),
      },
    ), 20000);
    if (!res.ok) { await logProvider({ kind: "vision", provider: "gemini", status: "fail", durationMs: Date.now() - t0, detail: `http ${res.status}` }); return null; }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) { await logProvider({ kind: "vision", provider: "gemini", status: "fail", durationMs: Date.now() - t0, detail: "empty" }); return null; }
    await logProvider({ kind: "vision", provider: "gemini", status: "success", durationMs: Date.now() - t0 });
    return clean(text);
  } catch (e) {
    const msg = (e as Error).message;
    await logProvider({ kind: "vision", provider: "gemini", status: msg === "timeout" ? "timeout" : "fail", durationMs: Date.now() - t0, detail: msg });
    return null;
  }
}

async function tryHuggingFace(imageBase64: string, mimeType: string): Promise<string | null> {
  const key = Deno.env.get("HUGGINGFACE_API_KEY");
  const t0 = Date.now();
  if (!key) { await logProvider({ kind: "vision", provider: "huggingface", status: "fail", durationMs: 0, detail: "no key" }); return null; }
  try {
    const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const res = await withTimeout(fetch("https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": mimeType },
      body: bytes,
    }), 25000);
    if (!res.ok) { await logProvider({ kind: "vision", provider: "huggingface", status: "fail", durationMs: Date.now() - t0, detail: `http ${res.status}` }); return null; }
    const data = await res.json();
    const caption = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
    if (!caption) { await logProvider({ kind: "vision", provider: "huggingface", status: "fail", durationMs: Date.now() - t0, detail: "empty" }); return null; }
    await logProvider({ kind: "vision", provider: "huggingface", status: "success", durationMs: Date.now() - t0 });
    return `Description de l'image : ${clean(caption)}`;
  } catch (e) {
    const msg = (e as Error).message;
    await logProvider({ kind: "vision", provider: "huggingface", status: msg === "timeout" ? "timeout" : "fail", durationMs: Date.now() - t0, detail: msg });
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { imageBase64, mimeType = "image/jpeg", prompt = PROMPT_DEFAULT } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ analysis: "Image manquante." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cascade forcée — tente toujours le suivant en cas d'échec/timeout
    let analysis: string | null = null;
    let provider = "none";
    analysis = await tryLovableAI(imageBase64, mimeType, prompt);
    if (analysis) provider = "lovable";
    if (!analysis) { analysis = await tryGeminiDirect(imageBase64, mimeType, prompt); if (analysis) provider = "gemini"; }
    if (!analysis) { analysis = await tryHuggingFace(imageBase64, mimeType); if (analysis) provider = "huggingface"; }
    if (!analysis) analysis = "Je n'arrive pas à analyser cette image en ce moment. Réessaye dans un instant.";

    return new Response(JSON.stringify({ analysis, provider }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("vision fatal", (e as Error).message);
    return new Response(JSON.stringify({ analysis: "Je n'arrive pas à analyser cette image en ce moment." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
