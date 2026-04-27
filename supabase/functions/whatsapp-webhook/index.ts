// WhatsApp Business Cloud API — webhook + auto-réponse Cyounne 24/7
// + miroir Activepieces
import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function getCfg(supabase: any, service: string) {
  const { data } = await supabase.from("api_keys").select("api_key, extra_config, enabled").eq("service", service).maybeSingle();
  return data;
}

async function askCyounne(text: string): Promise<string> {
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/cyounne-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({
        messages: [{ role: "user", content: text }],
        isAdmin: false,
        gender: "unknown",
      }),
    });
    const data = await res.json();
    return data?.content ?? "Aucune donnée exploitable disponible.";
  } catch {
    return "Aucune donnée exploitable disponible.";
  }
}

async function sendWhatsApp(cfg: any, to: string, body: string) {
  const phoneId = cfg?.extra_config?.phone_number_id;
  const token = cfg?.extra_config?.access_token || cfg?.api_key;
  if (!phoneId || !token) throw new Error("WhatsApp non configuré");
  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data?.messages?.[0]?.id;
}

async function mirrorToActivepieces(supabase: any, payload: any) {
  const ap = await getCfg(supabase, "activepieces");
  const url = ap?.extra_config?.webhook_url;
  if (!url || !ap?.enabled) return;
  try {
    await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
  } catch (e) {
    console.warn("Activepieces mirror failed:", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const url = new URL(req.url);

  // 1) Vérification du webhook par Meta
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const cfg = await getCfg(supabase, "whatsapp_business");
    const verifyToken = cfg?.extra_config?.verify_token || "cyounne_verify";
    if (mode === "subscribe" && token === verifyToken) {
      return new Response(challenge ?? "", { status: 200 });
    }
    return new Response("forbidden", { status: 403 });
  }

  // 2) Réception des messages
  try {
    const body = await req.json();
    const cfg = await getCfg(supabase, "whatsapp_business");

    const entries = body?.entry ?? [];
    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const messages = value.messages ?? [];
        for (const msg of messages) {
          const from = msg.from;
          const text = msg.text?.body ?? msg.button?.text ?? msg.interactive?.button_reply?.title ?? "";
          if (!from || !text) continue;

          // Journaliser entrée
          await supabase.from("whatsapp_messages").insert({
            wa_message_id: msg.id,
            from_number: from,
            to_number: value.metadata?.display_phone_number,
            direction: "in",
            body: text,
            status: "received",
            metadata: { contact: value.contacts?.[0] ?? null },
          });

          // Demander à Cyounne
          const reply = await askCyounne(text);

          // Répondre WhatsApp
          let outId: string | undefined;
          let sendErr: string | null = null;
          try {
            outId = await sendWhatsApp(cfg, from, reply);
          } catch (e) {
            sendErr = (e as Error).message;
          }

          await supabase.from("whatsapp_messages").insert({
            wa_message_id: outId,
            from_number: value.metadata?.display_phone_number ?? "cyounne",
            to_number: from,
            direction: "out",
            body: reply,
            cyounne_reply: reply,
            status: sendErr ? `error:${sendErr.slice(0,200)}` : "sent",
            metadata: { in_reply_to: msg.id },
          });

          // Miroir Activepieces (workflow externe, alertes, CRM…)
          await mirrorToActivepieces(supabase, {
            event: "whatsapp_message",
            from, text, reply,
            wa_id: msg.id,
            out_id: outId,
          });
        }
      }
    }
    return new Response("EVENT_RECEIVED", { status: 200 });
  } catch (e) {
    console.error("whatsapp-webhook error:", e);
    return new Response("error", { status: 200 }); // ne pas faire retry Meta
  }
});
