// OneSignal — envoi de push depuis l'admin Cyounne
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
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

    const { title, message, url, player_ids, segments, target } = await req.json();
    if (!title || !message) return new Response(JSON.stringify({ error: "title + message required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Ciblage par segment Cyounne : all | active | at_risk
    let resolvedPlayerIds: string[] | null = null;
    if (!player_ids?.length && target && target !== "all") {
      // Récupère les membres correspondant au segment
      let q = supabase.from("members").select("user_id, status, trust_score");
      if (target === "active") q = q.eq("status", "actif");
      else if (target === "at_risk") q = q.lt("trust_score", 60);
      const { data: mbs } = await q;
      const userIds = (mbs ?? []).map((m: any) => m.user_id).filter(Boolean);
      if (userIds.length) {
        const { data: subs } = await supabase
          .from("push_subscriptions")
          .select("player_id")
          .in("user_id", userIds);
        resolvedPlayerIds = (subs ?? []).map((s: any) => s.player_id).filter(Boolean);
      } else {
        resolvedPlayerIds = [];
      }
    }

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
    else if (resolvedPlayerIds !== null) {
      if (resolvedPlayerIds.length === 0) {
        return new Response(JSON.stringify({ ok: true, id: null, recipients: 0, note: `Aucun abonné pour le segment ${target}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      payload.include_player_ids = resolvedPlayerIds;
    }
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
    await supabase.from("audit_log").insert({ user_id: user.id, action: "push_sent", target: target || "all", details: { title, message, recipients: data.recipients ?? null, segment: target || "all" } });
    return new Response(JSON.stringify({ ok: true, id: data.id, recipients: data.recipients }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
