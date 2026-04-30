// Cyounne Vision — Lovable AI (Gemini) primary, HuggingFace fallback. Erreurs jamais exposées.
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

async function tryLovableAI(imageBase64: string, mimeType: string, prompt: string): Promise<string | null> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
    });
    if (!res.ok) { console.warn("LovableAI vision", res.status, await res.text().catch(() => "")); return null; }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return text ? clean(text) : null;
  } catch (e) { console.warn("LovableAI vision error", (e as Error).message); return null; }
}

async function tryGeminiDirect(imageBase64: string, mimeType: string, prompt: string): Promise<string | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageBase64 } }] }],
        }),
      },
    );
    if (!res.ok) { console.warn("Gemini direct", res.status); return null; }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return text ? clean(text) : null;
  } catch (e) { console.warn("Gemini direct error", (e as Error).message); return null; }
}

async function tryHuggingFace(imageBase64: string, mimeType: string): Promise<string | null> {
  const key = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!key) return null;
  try {
    const bytes = Uint8Array.from(atob(imageBase64), (c) => c.charCodeAt(0));
    const res = await fetch("https://api-inference.huggingface.co/models/Salesforce/blip-image-captioning-large", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": mimeType },
      body: bytes,
    });
    if (!res.ok) { console.warn("HF vision", res.status); return null; }
    const data = await res.json();
    const caption = Array.isArray(data) ? data[0]?.generated_text : data?.generated_text;
    return caption ? `Description de l'image : ${clean(caption)}` : null;
  } catch (e) { console.warn("HF vision error", (e as Error).message); return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { imageBase64, mimeType = "image/jpeg", prompt = PROMPT_DEFAULT } = await req.json();
    if (!imageBase64) {
      return new Response(JSON.stringify({ analysis: "Image manquante." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let analysis = await tryLovableAI(imageBase64, mimeType, prompt);
    if (!analysis) analysis = await tryGeminiDirect(imageBase64, mimeType, prompt);
    if (!analysis) analysis = await tryHuggingFace(imageBase64, mimeType);
    if (!analysis) analysis = "Je n'arrive pas à analyser cette image en ce moment. Réessaye dans un instant.";

    return new Response(JSON.stringify({ analysis }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("vision fatal", (e as Error).message);
    return new Response(JSON.stringify({ analysis: "Je n'arrive pas à analyser cette image en ce moment." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
