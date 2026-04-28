// Gemini Vision — analyse photos / OCR / reconnaissance
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { imageBase64, mimeType = "image/jpeg", prompt = "Analyse cette image en détail. Si tu détectes du texte, fais l'OCR. Si tu détectes une personne ou un logo, décris-le précisément." } = await req.json();
    if (!imageBase64) return new Response(JSON.stringify({ error: "image required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "GEMINI_API_KEY missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
            ],
          }],
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini Vision error:", err);
      return new Response(JSON.stringify({ error: "vision_failed", detail: err }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Analyse impossible, données insuffisantes";
    const analysis = raw
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/^\s*[-*+]\s+/gm, "")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/\bMr\.?\s*EKEKE\b/gi, "Monsieur ÉKÉKÉ")
      .replace(/\bMarcy-B\s+EKEKE\b/gi, "Monsieur ÉKÉKÉ");
    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
