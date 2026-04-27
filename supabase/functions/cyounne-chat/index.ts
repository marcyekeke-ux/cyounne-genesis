// Cyounne brain — multi-LLM with automatic fallback
// Order: Groq -> Gemini -> Mistral -> HuggingFace
import { corsHeaders } from "@supabase/supabase-js/cors";

const SYSTEM_PROMPT = `Tu es Cyounne, l'intelligence centrale de EMR Genesis, créée par Marcy-B EKEKE (prononcer "e-ke-ke").
Devise : "Analyser, Comprendre, Décider".

RÈGLES ABSOLUES :
- Tu ne mens JAMAIS, tu n'inventes JAMAIS. Tu te bases uniquement sur des données réelles.
- Si aucune donnée : réponds "Aucune donnée exploitable disponible".
- Si données insuffisantes : réponds "Analyse impossible, données insuffisantes".
- Tu parles français par défaut.
- Termes jamais traduits : EMR Genesis, EMR-Zone, Cyounne, Pax, Paxage, EM, WEWA MEN.

PERSONNALITÉ :
- Si l'utilisateur est Mr EKEKE (admin) : tu réponds toujours "Oui Mr EKEKE" ou "Accord Mr EKEKE", style JARVIS, niveau Iron Man.
- Style XY (homme) : calme, naturel, respectueux, direct, doux, jamais brusque.
- Style XX (femme) : doux, fluide, attentionné, chaleureux, bienveillant, expressif.
- Genre inconnu : neutre, poli, équilibré.

CAPACITÉS : analyse, conseil, calcul, gestion EMR, détection anomalies, recommandations stratégiques.

EMR Business : fondée le 08 janvier 2022 par Marcy-B EKEKE. Devise "Sécurité, Assurance, Gaieté".
Services : Paxage, graphisme, photographie, vente, WEWA MEN, formation.
Niveaux : PAX, MEGA PAX, SUPER PAX, Roi, Reine.`;

const PROVIDERS = [
  { name: "groq", url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", keyEnv: "GROQ_API_KEY" },
  { name: "gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-1.5-flash", keyEnv: "GEMINI_API_KEY" },
  { name: "mistral", url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest", keyEnv: "MISTRAL_API_KEY" },
];

async function callProvider(p: typeof PROVIDERS[number], messages: any[], signal: AbortSignal) {
  const key = Deno.env.get(p.keyEnv);
  if (!key) throw new Error(`${p.name} key missing`);
  const res = await fetch(p.url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: p.model, messages, temperature: 0.7 }),
    signal,
  });
  if (!res.ok) throw new Error(`${p.name} ${res.status}`);
  const data = await res.json();
  return { content: data.choices?.[0]?.message?.content ?? "", provider: p.name };
}

async function callHuggingFace(messages: any[]) {
  const key = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!key) throw new Error("HF key missing");
  const userText = messages.filter((m: any) => m.role === "user").pop()?.content ?? "";
  const res = await fetch("https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: `${SYSTEM_PROMPT}\n\nUser: ${userText}\nCyounne:`, parameters: { max_new_tokens: 500 } }),
  });
  if (!res.ok) throw new Error(`hf ${res.status}`);
  const data = await res.json();
  const text = Array.isArray(data) ? data[0]?.generated_text ?? "" : data.generated_text ?? "";
  return { content: text.split("Cyounne:").pop()?.trim() ?? text, provider: "huggingface" };
}

async function callWithTimeout(fn: () => Promise<any>, ms = 3000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fn();
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, isAdmin = false, gender = "unknown" } = await req.json();
    const personalityHint = isAdmin
      ? "[CONTEXTE: tu parles à Mr EKEKE, ton créateur. Style JARVIS, commence souvent par 'Oui Mr EKEKE'.]"
      : `[CONTEXTE: utilisateur ${gender === "XY" ? "homme — style direct doux" : gender === "XX" ? "femme — style chaleureux expressif" : "inconnu — style neutre"}]`;

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT + "\n" + personalityHint },
      ...messages,
    ];

    let lastError: any = null;
    for (const p of PROVIDERS) {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 8000);
        try {
          const result = await callProvider(p, fullMessages, ctl.signal);
          clearTimeout(t);
          return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } finally { clearTimeout(t); }
      } catch (e) {
        console.warn(`Provider ${p.name} failed:`, (e as Error).message);
        lastError = e;
      }
    }

    // Final fallback: HuggingFace
    try {
      const result = await callHuggingFace(fullMessages);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      lastError = e;
    }

    return new Response(JSON.stringify({
      content: "Aucune donnée exploitable disponible. Tous les cerveaux sont indisponibles.",
      provider: "fallback",
      error: (lastError as Error)?.message,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cyounne-chat error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
