// Cyounne — analyse documents (PDF, Word, Excel, texte) — Cascade Lovable → Gemini → HF, journal interne.
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

async function logProvider(entry: {
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
        action: "cyounne_doc_provider",
        target: entry.provider,
        details: { status: entry.status, durationMs: entry.durationMs, detail: entry.detail ?? null, ts: new Date().toISOString() },
      }),
    });
  } catch (_) { /* silent */ }
  console.log(`[provider-log] kind=doc provider=${entry.provider} status=${entry.status} ms=${entry.durationMs}${entry.detail ? " detail=" + entry.detail : ""}`);
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

async function tryLovableAI(fileBase64: string, mimeType: string, prompt: string): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  const t0 = Date.now();
  if (!key) { await logProvider({ provider: "lovable", status: "fail", durationMs: 0, detail: "no key" }); return null; }
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
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
          ],
        }],
      }),
    }), 25000);
    if (!res.ok) { await logProvider({ provider: "lovable", status: "fail", durationMs: Date.now() - t0, detail: `http ${res.status}` }); return null; }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    if (!text) { await logProvider({ provider: "lovable", status: "fail", durationMs: Date.now() - t0, detail: "empty" }); return null; }
    await logProvider({ provider: "lovable", status: "success", durationMs: Date.now() - t0 });
    return clean(text);
  } catch (e) {
    const msg = (e as Error).message;
    await logProvider({ provider: "lovable", status: msg === "timeout" ? "timeout" : "fail", durationMs: Date.now() - t0, detail: msg });
    return null;
  }
}

async function tryGeminiDirect(fileBase64: string, mimeType: string, prompt: string): Promise<string | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  const t0 = Date.now();
  if (!key) { await logProvider({ provider: "gemini", status: "fail", durationMs: 0, detail: "no key" }); return null; }
  try {
    const res = await withTimeout(fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: fileBase64 } }] }],
        }),
      },
    ), 25000);
    if (!res.ok) { await logProvider({ provider: "gemini", status: "fail", durationMs: Date.now() - t0, detail: `http ${res.status}` }); return null; }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!text) { await logProvider({ provider: "gemini", status: "fail", durationMs: Date.now() - t0, detail: "empty" }); return null; }
    await logProvider({ provider: "gemini", status: "success", durationMs: Date.now() - t0 });
    return clean(text);
  } catch (e) {
    const msg = (e as Error).message;
    await logProvider({ provider: "gemini", status: msg === "timeout" ? "timeout" : "fail", durationMs: Date.now() - t0, detail: msg });
    return null;
  }
}

async function tryHuggingFace(fileBase64: string, mimeType: string): Promise<string | null> {
  const key = Deno.env.get("HUGGINGFACE_API_KEY");
  const t0 = Date.now();
  if (!key) { await logProvider({ provider: "huggingface", status: "fail", durationMs: 0, detail: "no key" }); return null; }
  // HF text fallback: only useful when we can decode text. For images-as-doc we caption.
  try {
    if (mimeType.startsWith("image/")) {
      const bytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
      const res = await withTimeout(fetch("https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": mimeType },
        body: bytes,
      }), 25000);
      if (!res.ok) { await logProvider({ provider: "huggingface", status: "fail", durationMs: Date.now() - t0, detail: `http ${res.status}` }); return null; }
      const data = await res.json();
      const caption = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
      if (!caption) { await logProvider({ provider: "huggingface", status: "fail", durationMs: Date.now() - t0, detail: "empty" }); return null; }
      await logProvider({ provider: "huggingface", status: "success", durationMs: Date.now() - t0 });
      return `Aperçu : ${clean(caption)}`;
    }
    await logProvider({ provider: "huggingface", status: "fail", durationMs: Date.now() - t0, detail: "unsupported mime" });
    return null;
  } catch (e) {
    const msg = (e as Error).message;
    await logProvider({ provider: "huggingface", status: msg === "timeout" ? "timeout" : "fail", durationMs: Date.now() - t0, detail: msg });
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { fileBase64, mimeType, prompt, fileName } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ analysis: "Document manquant." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const finalPrompt = prompt ?? `Tu es Cyounne de EMR Genesis. Analyse ce document (${fileName ?? "document"}) en français. Donne un résumé clair, les points clés, les chiffres importants, et toute anomalie. Texte naturel uniquement, pas de markdown.`;

    let analysis: string | null = null;
    let provider = "none";
    analysis = await tryLovableAI(fileBase64, mimeType, finalPrompt);
    if (analysis) provider = "lovable";
    if (!analysis) { analysis = await tryGeminiDirect(fileBase64, mimeType, finalPrompt); if (analysis) provider = "gemini"; }
    if (!analysis) { analysis = await tryHuggingFace(fileBase64, mimeType); if (analysis) provider = "huggingface"; }
    if (!analysis) analysis = "Je n'arrive pas à analyser ce document en ce moment. Réessaye dans un instant.";

    return new Response(JSON.stringify({ analysis, provider }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("doc fatal", (e as Error).message);
    return new Response(JSON.stringify({ analysis: "Je n'arrive pas à analyser ce document en ce moment." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
