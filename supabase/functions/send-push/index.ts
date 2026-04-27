// OneSignal — envoi de push depuis l'admin Cyounne
import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "auth required" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = (roles ?? []).some((r: any) => r.role === "admin");
    if (!isAdmin) return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { title, message, url, player_ids, segments } = await req.json();
    if (!title || !message) return new Response(JSON.stringify({ error: "title + message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: row } = await supabase.from("api_keys").select("extra_config, api_key, enabled").eq("service", "onesignal").maybeSingle();
    if (!row || !row.enabled) return new Response(JSON.stringify({ error: "OneSignal désactivé" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const cfg = (row.extra_config ?? {}) as any;
    const appId = cfg.app_id || row.api_key;
    const restKey = cfg.rest_api_key;
    if (!appId || !restKey) return new Response(JSON.stringify({ error: "OneSignal app_id + rest_api_key requis" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const payload: any = {
      app_id: appId,
      headings: { en: title, fr: title },
      contents: { en: message, fr: message },
    };
    if (url) payload.url = url;
    if (player_ids?.length) payload.include_player_ids = player_ids;
    else payload.included_segments = segments?.length ? segments : ["Subscribed Users"];

    const res = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: { "Authorization": `Basic ${restKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: data?.errors?.[0] ?? "OneSignal error", details: data }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    await supabase.from("audit_log").insert({ user_id: user.id, action: "push_sent", target: "onesignal", details: { title, message, recipients: data.recipients ?? null } });
    return new Response(JSON.stringify({ ok: true, id: data.id, recipients: data.recipients }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
