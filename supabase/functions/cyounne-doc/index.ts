// Cyounne — analyse documents (PDF, Word, Excel, texte) — Lovable AI + Gemini direct fallback
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

async function tryLovableAI(fileBase64: string, mimeType: string, prompt: string): Promise<string | null> {
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
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${fileBase64}` } },
          ],
        }],
      }),
    });
    if (!res.ok) { console.warn("LovableAI doc", res.status); return null; }
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? "";
    return text ? clean(text) : null;
  } catch (e) { console.warn("LovableAI doc err", (e as Error).message); return null; }
}

async function tryGeminiDirect(fileBase64: string, mimeType: string, prompt: string): Promise<string | null> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: fileBase64 } }] }],
        }),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return text ? clean(text) : null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { fileBase64, mimeType, prompt, fileName } = await req.json();
    if (!fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ analysis: "Document manquant." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const finalPrompt = prompt ?? `Tu es Cyounne de EMR Genesis. Analyse ce document (${fileName ?? "document"}) en français. Donne un résumé clair, les points clés, les chiffres importants, et toute anomalie. Texte naturel uniquement, pas de markdown.`;

    let analysis = await tryLovableAI(fileBase64, mimeType, finalPrompt);
    if (!analysis) analysis = await tryGeminiDirect(fileBase64, mimeType, finalPrompt);
    if (!analysis) analysis = "Je n'arrive pas à analyser ce document en ce moment. Réessaye dans un instant.";

    return new Response(JSON.stringify({ analysis }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("doc fatal", (e as Error).message);
    return new Response(JSON.stringify({ analysis: "Je n'arrive pas à analyser ce document en ce moment." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
