// Cyounne Admin Gateway — toutes les opérations admin passent ici.
// Pas de compte utilisateur : un mot de passe secret (ADMIN_SECRET_PASSWORD) ouvre un jeton de session
// qui est ensuite envoyé avec chaque requête admin. La fonction utilise la SERVICE ROLE KEY côté serveur,
// ce qui contourne RLS — la sécurité réelle vient du mot de passe + du jeton signé HMAC.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_PWD = Deno.env.get("ADMIN_SECRET_PASSWORD") ?? "";
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const enc = new TextEncoder();
async function hmac(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(ADMIN_PWD || "no-password"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function issueToken(role: string = "admin"): Promise<string> {
  const exp = Date.now() + TOKEN_TTL_MS;
  const payload = `cyounne-admin.${role}.${exp}`;
  const sig = await hmac(payload);
  return `${role}.${exp}.${sig}`;
}

async function verifyToken(token: string | undefined | null): Promise<{ ok: boolean; role?: string }> {
  if (!token) return { ok: false };
  const parts = token.split(".");
  // Rétro-compat: ancien format `${exp}.${sig}` → admin
  if (parts.length === 2) {
    const [expStr, sig] = parts;
    const exp = Number(expStr);
    if (!exp || Number.isNaN(exp) || exp < Date.now()) return { ok: false };
    const expected = await hmac(`cyounne-admin.${exp}`);
    return expected === sig ? { ok: true, role: "admin" } : { ok: false };
  }
  if (parts.length !== 3) return { ok: false };
  const [role, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!exp || Number.isNaN(exp) || exp < Date.now()) return { ok: false };
  if (!ROLE_TABLE_ACL[role]) return { ok: false };
  const expected = await hmac(`cyounne-admin.${role}.${exp}`);
  return expected === sig ? { ok: true, role } : { ok: false };
}

// Permissions strictes par rôle — la gateway service-role n'expose que ces tables.
// admin = Monsieur ÉKÉKÉ (clé maître via mot de passe). team_leader = gestion limitée. pax = lecture profil.
type Op = "select" | "insert" | "update" | "upsert" | "delete";
const ROLE_TABLE_ACL: Record<string, Partial<Record<string, Op[]>>> = {
  admin: {
    api_keys: ["select", "insert", "update", "upsert", "delete"],
    knowledge: ["select", "insert", "update", "upsert", "delete"],
    media_assets: ["select", "insert", "update", "upsert", "delete"],
    members: ["select", "insert", "update", "upsert", "delete"],
    alerts: ["select", "insert", "update", "upsert", "delete"],
    reports: ["select", "insert", "update", "upsert", "delete"],
    conversations: ["select", "insert", "update", "upsert", "delete"],
    messages: ["select", "insert", "update", "upsert", "delete"],
    user_roles: ["select", "insert", "update", "upsert", "delete"],
    audit_log: ["select", "insert"],
    push_subscriptions: ["select", "insert", "delete"],
    whatsapp_messages: ["select", "insert", "update", "delete"],
    profiles: ["select", "update"],
  },
  team_leader: {
    members: ["select", "update"],
    knowledge: ["select"],
    media_assets: ["select"],
    alerts: ["select", "insert", "update"],
    reports: ["select"],
    profiles: ["select"],
  },
  pax: {
    knowledge: ["select"],
    media_assets: ["select"],
    profiles: ["select"],
  },
};

function aclCheck(role: string, table: string, op: Op): { ok: boolean; reason?: string } {
  const tables = ROLE_TABLE_ACL[role];
  if (!tables) return { ok: false, reason: `rôle inconnu: ${role}` };
  const ops = tables[table];
  if (!ops) return { ok: false, reason: `table interdite pour ${role}: ${table}` };
  if (!ops.includes(op)) return { ok: false, reason: `opération ${op} interdite sur ${table} pour ${role}` };
  return { ok: true };
}

// Mapping clés admin → noms de secrets / lignes api_keys (`service`)
type KeyDef = { name: string; secret?: string; service?: string; field?: "api_key" | string; jsonPath?: string[] };
const KEY_CATALOG: Record<string, KeyDef> = {
  GROQ: { name: "GROQ", secret: "GROQ_API_KEY" },
  GEMINI: { name: "GEMINI", secret: "GEMINI_API_KEY" },
  MISTRAL: { name: "MISTRAL", secret: "MISTRAL_API_KEY" },
  HUGGINGFACE: { name: "HUGGINGFACE", secret: "HUGGINGFACE_API_KEY" },
  ELEVENLABS: { name: "ELEVENLABS", secret: "ELEVENLABS_API_KEY" },
  ELEVENLABS_VOICE_XY: { name: "ELEVENLABS_VOICE_XY", secret: "ELEVENLABS_VOICE_XY_NICOLAS_ID", service: "elevenlabs", jsonPath: ["voice_xy_id"] },
  ELEVENLABS_VOICE_XX: { name: "ELEVENLABS_VOICE_XX", secret: "ELEVENLABS_VOICE_XX_JADE_ID", service: "elevenlabs", jsonPath: ["voice_xx_id"] },
  DEEPGRAM: { name: "DEEPGRAM", secret: "DEEPGRAM_API_KEY" },
  BREVO: { name: "BREVO", secret: "BREVO_API_KEY", service: "brevo" },
  ONESIGNAL_APP_ID: { name: "ONESIGNAL_APP_ID", secret: "ONESIGNAL_APP_ID", service: "onesignal", jsonPath: ["app_id"] },
  ONESIGNAL_API_KEY: { name: "ONESIGNAL_API_KEY", secret: "ONESIGNAL_API_KEY", service: "onesignal", jsonPath: ["rest_api_key"] },
  WHATSAPP_TOKEN: { name: "WHATSAPP_TOKEN", secret: "WHATSAPP_TOKEN", service: "whatsapp_business", jsonPath: ["access_token"] },
  WHATSAPP_PHONE_NUMBER_ID: { name: "WHATSAPP_PHONE_NUMBER_ID", service: "whatsapp_business", jsonPath: ["phone_number_id"] },
  WHATSAPP_BUSINESS_ID: { name: "WHATSAPP_BUSINESS_ID", service: "whatsapp_business", jsonPath: ["business_account_id"] },
  CLOUDINARY: { name: "CLOUDINARY", secret: "CLOUDINARY_API_KEY", service: "cloudinary" },
  TELEGRAM_BOT_TOKEN: { name: "TELEGRAM_BOT_TOKEN", secret: "TELEGRAM_BOT_TOKEN", service: "telegram" },
};

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, token } = body as { action?: string; token?: string };

    if (!action) return json({ error: "action required" }, 400);

    // ── Auth: déverrouillage par mot de passe ───────────────────────────────
    if (action === "unlock") {
      const pwd = body.password ?? "";
      if (!ADMIN_PWD) return json({ error: "ADMIN_SECRET_PASSWORD non configuré" }, 500);
      if (pwd !== ADMIN_PWD) return json({ error: "Mot de passe incorrect" }, 401);
      const t = await issueToken();
      return json({ token: t, ttl_ms: TOKEN_TTL_MS });
    }

    if (action === "verify") {
      const v = await verifyToken(token);
      return json({ ok: v.ok, role: v.role });
    }

    // ── Toutes les autres actions exigent un jeton valide ──────────────────
    const auth = await verifyToken(token);
    if (!auth.ok) return json({ error: "Session admin expirée ou invalide" }, 401);
    const role = auth.role!;

    // Actions admin-only (clés API, import, stats globales, audit, storage)
    const ADMIN_ONLY = new Set(["key_status", "import_keys", "storage_upload"]);
    if (ADMIN_ONLY.has(action) && role !== "admin") {
      return json({ error: `action ${action} réservée à l'administrateur` }, 403);
    }

    const sb = admin();

    // ── Statut des clés (sans révéler les valeurs) ─────────────────────────
    if (action === "key_status") {
      const result: Record<string, { hasSecret: boolean; hasDb: boolean }> = {};
      const { data: rows } = await sb.from("api_keys").select("service, api_key, extra_config, enabled");
      const dbByService = new Map<string, any>();
      (rows ?? []).forEach((r: any) => dbByService.set(r.service, r));

      for (const [k, def] of Object.entries(KEY_CATALOG)) {
        const hasSecret = def.secret ? !!Deno.env.get(def.secret) : false;
        let hasDb = false;
        if (def.service) {
          const row = dbByService.get(def.service);
          if (row) {
            if (def.jsonPath) {
              const v = (row.extra_config ?? {})[def.jsonPath[0]];
              hasDb = !!v;
            } else {
              hasDb = !!row.api_key;
            }
          }
        }
        result[k] = { hasSecret, hasDb };
      }
      return json({ keys: result });
    }

    // ── Import groupé : on n’écrit en base QUE les clés non encore configurées ──
    if (action === "import_keys") {
      const entries = (body.entries ?? {}) as Record<string, string>;
      const added: string[] = [];
      const skipped: string[] = [];
      const errors: { key: string; error: string }[] = [];

      // Regrouper par service (DB)
      const perService: Record<string, { api_key?: string; extra_config: Record<string, any> }> = {};
      const directOnly: { key: string; def: KeyDef; value: string }[] = [];

      for (const [k, raw] of Object.entries(entries)) {
        const v = (raw ?? "").trim();
        if (!v) continue;
        const def = KEY_CATALOG[k];
        if (!def) { errors.push({ key: k, error: "clé inconnue" }); continue; }
        if (def.secret && Deno.env.get(def.secret)) { skipped.push(k); continue; }

        if (def.service) {
          perService[def.service] ??= { extra_config: {} };
          if (def.jsonPath) perService[def.service].extra_config[def.jsonPath[0]] = v;
          else perService[def.service].api_key = v;
        } else {
          directOnly.push({ key: k, def, value: v });
        }
      }

      // Upsert en base (api_keys)
      for (const [service, payload] of Object.entries(perService)) {
        const { data: existing } = await sb.from("api_keys").select("extra_config, api_key").eq("service", service).maybeSingle();
        const merged_extra = { ...(existing?.extra_config ?? {}), ...payload.extra_config };
        const final_api_key = payload.api_key ?? existing?.api_key ?? null;
        const { error } = await sb.from("api_keys").upsert(
          { service, api_key: final_api_key, extra_config: merged_extra, enabled: true, updated_at: new Date().toISOString() },
          { onConflict: "service" },
        );
        if (error) errors.push({ key: service, error: error.message });
        else added.push(service);
      }

      // Pour les clés purement “secrets backend” qui ne sont pas configurées,
      // on les garde en mémoire (Lovable injectera via la prochaine étape secrets).
      for (const d of directOnly) {
        skipped.push(`${d.key} (à ajouter dans Secrets)`);
      }

      return json({ added, skipped, errors });
    }

    // ── Operations CRUD sécurisées sur tables admin ────────────────────────
    if (action === "select") {
      const { table, columns = "*", filters = {}, order, limit } = body;
      const c = aclCheck(role, table, "select");
      if (!c.ok) return json({ error: c.reason }, 403);
      let q = sb.from(table).select(columns);
      for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
      if (order) q = q.order(order.column, { ascending: order.ascending !== false });
      if (limit) q = q.limit(limit);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "insert") {
      const { table, values } = body;
      const c = aclCheck(role, table, "insert");
      if (!c.ok) return json({ error: c.reason }, 403);
      const { data, error } = await sb.from(table).insert(values).select();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "update") {
      const { table, values, match } = body;
      const c = aclCheck(role, table, "update");
      if (!c.ok) return json({ error: c.reason }, 403);
      let q = sb.from(table).update(values);
      for (const [k, v] of Object.entries(match ?? {})) q = q.eq(k, v);
      const { data, error } = await q.select();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "upsert") {
      const { table, values, onConflict } = body;
      const c = aclCheck(role, table, "upsert");
      if (!c.ok) return json({ error: c.reason }, 403);
      const { data, error } = await sb.from(table).upsert(values, onConflict ? { onConflict } : undefined).select();
      if (error) return json({ error: error.message }, 400);
      return json({ data });
    }

    if (action === "delete") {
      const { table, match } = body;
      const c = aclCheck(role, table, "delete");
      if (!c.ok) return json({ error: c.reason }, 403);
      let q = sb.from(table).delete();
      for (const [k, v] of Object.entries(match ?? {})) q = q.eq(k, v);
      const { error } = await q;
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === "storage_upload") {
      const { bucket = "media", path, base64, contentType } = body;
      if (!path || !base64) return json({ error: "path + base64 requis" }, 400);
      const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const { error: upErr } = await sb.storage.from(bucket).upload(path, bin, { contentType, upsert: false });
      if (upErr) return json({ error: upErr.message }, 400);
      const { data: { publicUrl } } = sb.storage.from(bucket).getPublicUrl(path);
      return json({ path, publicUrl });
    }

    if (action === "stats") {
      const tables = ["members", "alerts", "reports", "conversations", "knowledge", "media_assets"] as const;
      const out: Record<string, number> = {};
      for (const t of tables) {
        const { count } = await sb.from(t).select("id", { count: "exact", head: true });
        out[t] = count ?? 0;
      }
      return json({ stats: out });
    }

    return json({ error: `action inconnue: ${action}` }, 400);
  } catch (e) {
    console.error("cyounne-admin error:", e);
    return json({ error: (e as Error).message ?? "erreur interne" }, 500);
  }
});
