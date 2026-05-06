// Cyounne Watcher — Agent autonome multi-apps
// Inspecte les bases Supabase connectées, détecte le schéma, journalise les événements.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildRemote } from "../_shared/remoteApp.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
}

// Détection du type d'app à partir des noms de tables
function inferAppType(tables: string[]): string {
  const t = tables.map((x) => x.toLowerCase());
  if (t.some((x) => x.includes("tontine") || x.includes("pax") || x.includes("versement"))) return "tontines";
  if (t.some((x) => x.includes("product") || x.includes("order") || x.includes("cart"))) return "marketplace";
  if (t.some((x) => x.includes("post") || x.includes("follow") || x.includes("feed"))) return "social";
  if (t.some((x) => x.includes("knowledge") && x.includes("members"))) return "emr_genesis";
  return "generic";
}

// Récupère la liste des tables publiques d'un projet Supabase distant via l'API REST
async function probeRemoteTables(url: string, anonKey: string): Promise<string[]> {
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/rest/v1/?apikey=${encodeURIComponent(anonKey)}`, {
      headers: { apikey: anonKey, Accept: "application/openapi+json" },
    });
    if (!r.ok) return [];
    const spec = await r.json();
    return Object.keys(spec?.definitions ?? {});
  } catch {
    return [];
  }
}

async function logEvent(db: any, appId: string | null, type: string, sev: string, title: string, desc: string, payload: any = {}) {
  await db.from("agent_events").insert({
    app_connection_id: appId,
    event_type: type,
    severity: sev,
    title,
    description: desc,
    payload,
  });
}

async function syncOne(db: any, conn: any) {
  const remote = buildRemote(conn);
  let tables: string[] = [];
  let pingInfo: any = null;
  try {
    tables = await remote.listTables();
    pingInfo = await remote.ping();
  } catch (e) {
    pingInfo = { ok: false, error: (e as Error).message };
  }
  const appType = conn.app_type === "unknown" ? inferAppType(tables) : conn.app_type;
  const status = (tables.length > 0 || pingInfo?.ok) ? "ok" : "no_tables";

  await db.from("app_connections").update({
    app_type: appType,
    schema_cache: { tables, scanned_at: new Date().toISOString() },
    last_sync_at: new Date().toISOString(),
    last_sync_status: status,
  }).eq("id", conn.id);

  await logEvent(db, conn.id, "sync", status === "ok" ? "info" : "warn",
    `Sync ${conn.name}`, `${tables.length} tables détectées (type: ${appType})`, { tables });

  return { id: conn.id, name: conn.name, app_type: appType, tables: tables.length, status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action ?? "scan_all";
    const db = admin();

    if (action === "scan_all") {
      const { data: conns } = await db.from("app_connections").select("*").eq("enabled", true);
      const results = [];
      for (const c of conns ?? []) results.push(await syncOne(db, c));
      return new Response(JSON.stringify({ ok: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "scan_one" && body.id) {
      const { data: c } = await db.from("app_connections").select("*").eq("id", body.id).maybeSingle();
      if (!c) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const r = await syncOne(db, c);
      return new Response(JSON.stringify({ ok: true, result: r }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("watcher error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
