// Deepgram STT — fallback Web Speech API côté client
import { corsHeaders } from "@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { audioBase64, mimeType = "audio/webm" } = await req.json();
    if (!audioBase64) return new Response(JSON.stringify({ error: "audio required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const apiKey = Deno.env.get("DEEPGRAM_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "no_key", fallback: "web_speech" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const binary = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));

    const res = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&language=fr&smart_format=true&punctuate=true",
      {
        method: "POST",
        headers: { "Authorization": `Token ${apiKey}`, "Content-Type": mimeType },
        body: binary,
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("Deepgram error:", err);
      return new Response(JSON.stringify({ error: "stt_failed", fallback: "web_speech", detail: err }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await res.json();
    const transcript = data.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? "";
    return new Response(JSON.stringify({ transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message, fallback: "web_speech" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
