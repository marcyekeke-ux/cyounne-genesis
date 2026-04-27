// ElevenLabs TTS — Nicolas (XY) / Jade (XX)
import { corsHeaders } from "@supabase/supabase-js/cors";

// Voice IDs from ElevenLabs (defaults — Mr EKEKE peut les remplacer dans api_keys.extra_config)
const DEFAULT_VOICE_XY = "JBFqnCBsd6RMkjVDRZzb"; // George (chaud masculin)
const DEFAULT_VOICE_XX = "XrExE9yKIg1WjnnlVkGX"; // Matilda (chaud féminin)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { text, gender = "XY", voiceId } = await req.json();
    if (!text) return new Response(JSON.stringify({ error: "text required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY missing", fallback: "web_speech" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const voice = voiceId || (gender === "XX" ? DEFAULT_VOICE_XX : DEFAULT_VOICE_XY);

    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.4, use_speaker_boost: true },
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("ElevenLabs error:", err);
      return new Response(JSON.stringify({ error: "tts_failed", fallback: "web_speech", detail: err }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const arrayBuffer = await res.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const base64 = btoa(binary);

    return new Response(JSON.stringify({ audio: base64, mime: "audio/mpeg" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message, fallback: "web_speech" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
