// Cyounne image generation — cascade: HuggingFace SD-2-1 -> FLUX -> Unsplash/Pexels fallback
// Règle absolue : ne jamais refuser, toujours renvoyer une image.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function logProvider(provider: string, status: string, ms: number, detail?: string) {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    await fetch(`${url}/rest/v1/audit_log`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ action: "cyounne_image_provider", target: provider, details: { status, ms, detail: detail ?? null } }),
    });
  } catch (_) {}
  console.log(`[image-provider] provider=${provider} status=${status} ms=${ms}${detail ? " detail=" + detail : ""}`);
}

async function tryHF(model: string, prompt: string, apiKey: string, timeoutMs = 25000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ inputs: prompt }),
      signal: ctl.signal,
    });
    if (!res.ok) throw new Error(`HF ${model} ${res.status}`);
    const ab = await res.arrayBuffer();
    const bytes = new Uint8Array(ab);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { image: btoa(bin), mime: "image/png", source: `huggingface:${model}` };
  } finally { clearTimeout(t); }
}

async function tryPexels(query: string) {
  const key = Deno.env.get("PEXELS_API_KEY");
  if (!key) throw new Error("no pexels key");
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`, {
    headers: { Authorization: key },
  });
  if (!r.ok) throw new Error(`pexels ${r.status}`);
  const d = await r.json();
  const url = d?.photos?.[0]?.src?.large2x ?? d?.photos?.[0]?.src?.original;
  if (!url) throw new Error("pexels empty");
  return { url, mime: "image/jpeg", source: "pexels" };
}

async function tryUnsplashSource(query: string) {
  // source.unsplash.com ne nécessite pas de clé — fallback ultime
  const url = `https://source.unsplash.com/1024x1024/?${encodeURIComponent(query)}`;
  return { url, mime: "image/jpeg", source: "unsplash" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { prompt } = await req.json();
    if (!prompt) return new Response(JSON.stringify({ error: "prompt required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const hfKey = Deno.env.get("HUGGINGFACE_API_KEY");
    const models = ["stabilityai/stable-diffusion-2-1", "black-forest-labs/FLUX.1-schnell"];

    if (hfKey) {
      for (const m of models) {
        const t0 = Date.now();
        try {
          const r = await tryHF(m, prompt, hfKey);
          await logProvider(r.source, "success", Date.now() - t0);
          return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } catch (e) {
          await logProvider(`huggingface:${m}`, "fail", Date.now() - t0, (e as Error).message);
        }
      }
    }

    // Fallback Pexels
    try {
      const t0 = Date.now();
      const r = await tryPexels(prompt);
      await logProvider("pexels", "success", Date.now() - t0);
      return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      await logProvider("pexels", "fail", 0, (e as Error).message);
    }

    // Fallback ultime Unsplash (sans clé) — on ne refuse JAMAIS
    const r = await tryUnsplashSource(prompt);
    await logProvider("unsplash", "success", 0);
    return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cyounne-image-gen error:", e);
    // Même en erreur on tente un fallback final
    try {
      const url = `https://source.unsplash.com/1024x1024/?image`;
      return new Response(JSON.stringify({ url, mime: "image/jpeg", source: "unsplash-emergency" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }
});
