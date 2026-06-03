// Lot 8D — Gestion API universelle
// Cascade de providers avec timeout 3s, basculement instantané, jamais d'exposition du provider à l'utilisateur.
// Couvre: aiText (LLM), notify (push/email/whatsapp/telegram), tts.
// Les logs internes mentionnent le provider; les retours vers l'utilisateur ne contiennent QUE le résultat.

const DEFAULT_TIMEOUT_MS = 3000;

function env(name: string): string | null {
  const v = Deno.env.get(name);
  return v && v.length > 0 ? v : null;
}

async function withTimeout<T>(p: Promise<T>, ms = DEFAULT_TIMEOUT_MS): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout_${ms}ms`)), ms)),
  ]);
}

export type CascadeResult<T> = {
  ok: boolean;
  data?: T;
  provider_used?: string; // pour logs internes uniquement
  attempts: { provider: string; ok: boolean; error?: string; ms: number }[];
  error?: string;
};

async function runCascade<T>(
  providers: { name: string; enabled: boolean; run: () => Promise<T> }[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<CascadeResult<T>> {
  const attempts: CascadeResult<T>["attempts"] = [];
  for (const p of providers) {
    if (!p.enabled) continue;
    const t0 = Date.now();
    try {
      const data = await withTimeout(p.run(), timeoutMs);
      attempts.push({ provider: p.name, ok: true, ms: Date.now() - t0 });
      return { ok: true, data, provider_used: p.name, attempts };
    } catch (e) {
      attempts.push({ provider: p.name, ok: false, error: (e as Error).message, ms: Date.now() - t0 });
    }
  }
  return { ok: false, attempts, error: "all_providers_failed" };
}

// =============== AI Text ===============
export type AiTextInput = { prompt: string; system?: string; maxTokens?: number; temperature?: number };

async function callGroq(inp: AiTextInput): Promise<string> {
  const key = env("GROQ_API_KEY");
  if (!key) throw new Error("no_key");
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        ...(inp.system ? [{ role: "system", content: inp.system }] : []),
        { role: "user", content: inp.prompt },
      ],
      temperature: inp.temperature ?? 0.5,
      max_tokens: inp.maxTokens ?? 512,
    }),
  });
  if (!r.ok) throw new Error(`groq_${r.status}`);
  const j = await r.json();
  const txt = j?.choices?.[0]?.message?.content;
  if (!txt) throw new Error("empty");
  return txt;
}

async function callGemini(inp: AiTextInput): Promise<string> {
  const key = env("GEMINI_API_KEY");
  if (!key) throw new Error("no_key");
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: (inp.system ? inp.system + "\n\n" : "") + inp.prompt }] }],
      generationConfig: { temperature: inp.temperature ?? 0.5, maxOutputTokens: inp.maxTokens ?? 512 },
    }),
  });
  if (!r.ok) throw new Error(`gemini_${r.status}`);
  const j = await r.json();
  const txt = j?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!txt) throw new Error("empty");
  return txt;
}

async function callMistral(inp: AiTextInput): Promise<string> {
  const key = env("MISTRAL_API_KEY");
  if (!key) throw new Error("no_key");
  const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [
        ...(inp.system ? [{ role: "system", content: inp.system }] : []),
        { role: "user", content: inp.prompt },
      ],
      temperature: inp.temperature ?? 0.5,
      max_tokens: inp.maxTokens ?? 512,
    }),
  });
  if (!r.ok) throw new Error(`mistral_${r.status}`);
  const j = await r.json();
  const txt = j?.choices?.[0]?.message?.content;
  if (!txt) throw new Error("empty");
  return txt;
}

async function callLovableAi(inp: AiTextInput): Promise<string> {
  const key = env("LOVABLE_API_KEY");
  if (!key) throw new Error("no_key");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        ...(inp.system ? [{ role: "system", content: inp.system }] : []),
        { role: "user", content: inp.prompt },
      ],
    }),
  });
  if (!r.ok) throw new Error(`lovable_${r.status}`);
  const j = await r.json();
  const txt = j?.choices?.[0]?.message?.content;
  if (!txt) throw new Error("empty");
  return txt;
}

export async function aiText(inp: AiTextInput, timeoutMs = DEFAULT_TIMEOUT_MS) {
  return runCascade<string>([
    { name: "groq", enabled: !!env("GROQ_API_KEY"), run: () => callGroq(inp) },
    { name: "gemini", enabled: !!env("GEMINI_API_KEY"), run: () => callGemini(inp) },
    { name: "mistral", enabled: !!env("MISTRAL_API_KEY"), run: () => callMistral(inp) },
    { name: "lovable_ai", enabled: !!env("LOVABLE_API_KEY"), run: () => callLovableAi(inp) },
  ], timeoutMs);
}

// =============== Notifications ===============
export type NotifyInput = {
  title?: string;
  message: string;
  // ciblage optionnel
  player_ids?: string[];        // OneSignal
  email?: string | null;        // Brevo
  whatsapp_to?: string | null;  // E.164 sans +
  telegram_chat_id?: string | null;
  // canaux préférés (ordre)
  channels?: ("push" | "whatsapp" | "telegram" | "email")[];
};

async function sendOneSignal(inp: NotifyInput): Promise<string> {
  const appId = env("ONESIGNAL_APP_ID");
  const apiKey = env("ONESIGNAL_API_KEY");
  if (!appId || !apiKey) throw new Error("no_key");
  const targets = inp.player_ids?.length ? { include_player_ids: inp.player_ids } : { included_segments: ["All"] };
  const r = await fetch("https://onesignal.com/api/v1/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${apiKey}` },
    body: JSON.stringify({
      app_id: appId,
      headings: { en: inp.title || "Cyounne" },
      contents: { en: inp.message },
      ...targets,
    }),
  });
  if (!r.ok) throw new Error(`onesignal_${r.status}`);
  return "delivered";
}

async function sendWhatsApp(inp: NotifyInput): Promise<string> {
  const token = env("WHATSAPP_TOKEN");
  const phoneId = env("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId || !inp.whatsapp_to) throw new Error("no_key");
  const r = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: inp.whatsapp_to,
      type: "text",
      text: { body: inp.message },
    }),
  });
  if (!r.ok) throw new Error(`whatsapp_${r.status}`);
  return "delivered";
}

async function sendTelegram(inp: NotifyInput): Promise<string> {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token || !inp.telegram_chat_id) throw new Error("no_key");
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: inp.telegram_chat_id, text: inp.message }),
  });
  if (!r.ok) throw new Error(`telegram_${r.status}`);
  return "delivered";
}

async function sendBrevo(inp: NotifyInput): Promise<string> {
  const key = env("BREVO_API_KEY");
  if (!key || !inp.email) throw new Error("no_key");
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": key },
    body: JSON.stringify({
      sender: { name: "Cyounne", email: "cyounne@emr-genesis.app" },
      to: [{ email: inp.email }],
      subject: inp.title || "Cyounne",
      htmlContent: `<p>${inp.message.replace(/\n/g, "<br/>")}</p>`,
    }),
  });
  if (!r.ok) throw new Error(`brevo_${r.status}`);
  return "delivered";
}

export async function notify(inp: NotifyInput, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const order = inp.channels && inp.channels.length ? inp.channels : ["push", "whatsapp", "telegram", "email"];
  const map: Record<string, { name: string; enabled: boolean; run: () => Promise<string> }> = {
    push:     { name: "push",     enabled: !!(env("ONESIGNAL_APP_ID") && env("ONESIGNAL_API_KEY")), run: () => sendOneSignal(inp) },
    whatsapp: { name: "whatsapp", enabled: !!(env("WHATSAPP_TOKEN") && env("WHATSAPP_PHONE_NUMBER_ID") && inp.whatsapp_to), run: () => sendWhatsApp(inp) },
    telegram: { name: "telegram", enabled: !!(env("TELEGRAM_BOT_TOKEN") && inp.telegram_chat_id), run: () => sendTelegram(inp) },
    email:    { name: "email",    enabled: !!(env("BREVO_API_KEY") && inp.email), run: () => sendBrevo(inp) },
  };
  return runCascade<string>(order.map((k) => map[k]).filter(Boolean), timeoutMs);
}

// =============== TTS ===============
export type TtsInput = { text: string; voice?: "xy" | "xx" };

async function ttsElevenLabs(inp: TtsInput): Promise<string> {
  const key = env("ELEVENLABS_API_KEY");
  if (!key) throw new Error("no_key");
  const voice = inp.voice === "xx" ? env("ELEVENLABS_VOICE_XX_JADE_ID") : env("ELEVENLABS_VOICE_XY_NICOLAS_ID");
  if (!voice) throw new Error("no_voice");
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: inp.text, model_id: "eleven_multilingual_v2" }),
  });
  if (!r.ok) throw new Error(`eleven_${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  return `data:audio/mpeg;base64,${btoa(String.fromCharCode(...buf))}`;
}

async function ttsDeepgram(inp: TtsInput): Promise<string> {
  const key = env("DEEPGRAM_API_KEY");
  if (!key) throw new Error("no_key");
  const r = await fetch("https://api.deepgram.com/v1/speak?model=aura-asteria-en", {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: inp.text }),
  });
  if (!r.ok) throw new Error(`deepgram_${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  return `data:audio/mpeg;base64,${btoa(String.fromCharCode(...buf))}`;
}

export async function tts(inp: TtsInput, timeoutMs = 6000) {
  return runCascade<string>([
    { name: "elevenlabs", enabled: !!env("ELEVENLABS_API_KEY"), run: () => ttsElevenLabs(inp) },
    { name: "deepgram",   enabled: !!env("DEEPGRAM_API_KEY"),   run: () => ttsDeepgram(inp) },
  ], timeoutMs);
}

// =============== Sanitize pour utilisateur ===============
// Retire toute mention de provider avant de retourner au client.
export function publicResult<T>(res: CascadeResult<T>) {
  return res.ok
    ? { ok: true, data: res.data }
    : { ok: false, error: "service_unavailable" };
}
