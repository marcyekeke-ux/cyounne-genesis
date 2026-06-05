// Cyounne Tontine Engine — Lot 8B (adapté au schéma EMR Tontines)
// Schéma cible: versements(statut, pax_id, montant, group_id, created_at)
//               pax_groups(pax_id, group_id, rang, date_sortie, etat_gain)
//               profiles(id, nom, prenom, telephone)
//               recus(versement_id, numero, pdf_url)
//               groups(versement_journalier, gain, statut)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildRemote, type AppConn } from "../_shared/remoteApp.ts";
import { buildTontineMessage, type Gender } from "../_shared/tontineMessages.ts";
import { aiText, notify, tts, publicResult } from "../_shared/apiCascade.ts";

async function dispatchNotify(title: string, message: string, profile: any) {
  try {
    const res = await notify({
      title,
      message,
      whatsapp_to: profile?.telephone || profile?.whatsapp || null,
      telegram_chat_id: profile?.telegram_chat_id || null,
      email: profile?.email || null,
    });
    return { delivered: res.ok, channel: res.provider_used || null };
  } catch { return { delivered: false, channel: null }; }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Rule = {
  id: string;
  app_connection_id: string;
  name: string;
  enabled: boolean;
  late_fee_formula: any;
  block_policy: any;
  congrats_policy: any;
  receipt_policy: any;
  table_mapping: any;
};

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
}

function computeLateFee(formula: any, daysLate: number, baseAmount = 0): number {
  if (daysLate <= 0) return 0;
  switch (formula?.type) {
    case "fixed_per_day": return Number(formula.value || 0) * daysLate;
    case "percent_per_week":
      return Math.ceil(daysLate / 7) * (baseAmount * Number(formula.value || 0) / 100);
    case "tiered": {
      const tiers = Array.isArray(formula.tiers) ? formula.tiers : [];
      const t = tiers.find((x: any) => daysLate >= x.from_day && daysLate <= x.to_day);
      return Number(t?.amount || 0);
    }
    default: return 0;
  }
}

async function logAction(rule_id: string | null, app_id: string | null, action_type: string, target: string | null, status: string, details: any) {
  try {
    await admin().from("tontine_actions").insert({ rule_id, app_connection_id: app_id, action_type, target_ref: target, status, details });
  } catch (e) { console.warn("logAction failed", (e as Error).message); }
}

async function emitEvent(app_id: string | null, type: string, title: string, severity = "info", description?: string, payload: any = {}) {
  try {
    await admin().from("agent_events").insert({ app_connection_id: app_id, event_type: type, title, severity, description, payload });
  } catch (_) {}
}

// Idempotence: vérifie si une action a déjà été enregistrée pour ce target_ref
async function alreadyDone(rule_id: string, action_type: string, target_ref: string): Promise<boolean> {
  const { data } = await admin().from("tontine_actions")
    .select("id").eq("rule_id", rule_id).eq("action_type", action_type).eq("target_ref", target_ref).limit(1);
  return (data?.length || 0) > 0;
}

// ============ Lot 8F — Checkpoints / reprise prompts ============
const PHASE_BUDGET_MS = 20000; // budget par run total
const MAX_ATTEMPTS = 5;

type PhaseStatus = "pending" | "running" | "done" | "failed" | "skipped";

async function getCheckpoint(rule_id: string, phase: string) {
  const { data } = await admin().from("tontine_checkpoints")
    .select("*").eq("rule_id", rule_id).eq("phase", phase).maybeSingle();
  return data as null | {
    id: string; rule_id: string; phase: string; cursor: any;
    status: PhaseStatus; last_error: string | null; attempts: number; summary: any;
  };
}

async function upsertCheckpoint(rule_id: string, app_id: string | null, phase: string,
  patch: { status?: PhaseStatus; cursor?: any; last_error?: string | null; summary?: any; bumpAttempts?: boolean }) {
  const existing = await getCheckpoint(rule_id, phase);
  if (!existing) {
    await admin().from("tontine_checkpoints").insert({
      rule_id, app_connection_id: app_id, phase,
      status: patch.status ?? "pending",
      cursor: patch.cursor ?? {},
      summary: patch.summary ?? {},
      last_error: patch.last_error ?? null,
      attempts: patch.bumpAttempts ? 1 : 0,
    });
  } else {
    const next: any = {
      status: patch.status ?? existing.status,
      cursor: patch.cursor ?? existing.cursor,
      summary: patch.summary ?? existing.summary,
      last_error: patch.last_error === undefined ? existing.last_error : patch.last_error,
      attempts: patch.bumpAttempts ? (existing.attempts + 1) : existing.attempts,
    };
    await admin().from("tontine_checkpoints").update(next).eq("id", existing.id);
  }
}

async function runPhase(
  rule: Rule, conn: AppConn, phase: string, deadline: number,
  fn: (cp: any) => Promise<{ cursor?: any; summary?: any }>,
): Promise<{ status: PhaseStatus; summary: any; error?: string }> {
  const existing = await getCheckpoint(rule.id, phase);
  if (existing?.status === "done") return { status: "done", summary: existing.summary || {} };
  if ((existing?.attempts || 0) >= MAX_ATTEMPTS && existing?.status === "failed") {
    return { status: "failed", summary: existing.summary || {}, error: existing.last_error || "max_attempts" };
  }
  if (Date.now() >= deadline) {
    await upsertCheckpoint(rule.id, conn.id, phase, { status: "pending", last_error: "deferred_budget_exhausted" });
    return { status: "pending", summary: existing?.summary || {}, error: "deferred" };
  }
  await upsertCheckpoint(rule.id, conn.id, phase, { status: "running", bumpAttempts: true, last_error: null });
  try {
    const res = await fn(existing);
    await upsertCheckpoint(rule.id, conn.id, phase, { status: "done", cursor: res.cursor ?? {}, summary: res.summary ?? {}, last_error: null });
    return { status: "done", summary: res.summary ?? {} };
  } catch (e) {
    const msg = (e as Error).message;
    await upsertCheckpoint(rule.id, conn.id, phase, { status: "failed", last_error: msg });
    await emitEvent(conn.id, `tontine_${phase}_error`, `Erreur ${phase}`, "warn", msg);
    return { status: "failed", summary: existing?.summary || {}, error: msg };
  }
}


async function runEngineForRule(rule: Rule, conn: AppConn, opts: { phases?: string[]; deadline?: number } = {}) {
  const map = rule.table_mapping || {};
  const t_versements = map.versements || "versements";
  const t_profiles = map.profiles || "profiles";
  const t_pax_groups = map.pax_groups || "pax_groups";
  const t_recus = map.recus || "recus";

  const r = buildRemote(conn);
  const summary = { late_fees: 0, blocked: 0, congrats: 0, receipts: 0, errors: 0, pax_in_late: 0 };
  const today = new Date();
  const deadline = opts.deadline ?? (Date.now() + PHASE_BUDGET_MS);
  const wanted = new Set(opts.phases?.length ? opts.phases : ["late_detection", "congrats", "receipts"]);
  const phases: Record<string, PhaseStatus> = {};

  if (wanted.has("late_detection")) {
    const res = await runPhase(rule, conn, "late_detection", deadline, async () => {
      const policy = rule.block_policy || {};
      const lateAfterDays = Number(policy.late_after_days || 2);
      const { data: pending, error } = await r.select(t_versements, { filters: { statut: "en_attente" }, limit: 1000 });
      if (error) throw new Error(error);
      const byPax = new Map<string, any[]>();
      for (const v of pending ?? []) {
        const created = v.created_at ? new Date(v.created_at) : null;
        const daysLate = created ? Math.floor((today.getTime() - created.getTime()) / 86400000) : 0;
        if (daysLate >= lateAfterDays) {
          if (!byPax.has(v.pax_id)) byPax.set(v.pax_id, []);
          byPax.get(v.pax_id)!.push({ ...v, daysLate });
        }
      }
      for (const [pax_id, vers] of byPax) {
        if (Date.now() >= deadline) throw new Error("budget_exceeded");
        const { data: profs0 } = await r.select(t_profiles, { filters: { id: pax_id }, limit: 1 });
        const p0 = profs0?.[0];
        const name0 = p0 ? `${p0.prenom || ""} ${p0.nom || ""}`.trim() : pax_id;
        const gender0 = (p0?.genre || p0?.sexe || "unknown") as Gender;
        for (const v of vers) {
          const target = `versement:${v.id}`;
          if (await alreadyDone(rule.id, "late_fee_applied", target)) continue;
          const fee = computeLateFee(rule.late_fee_formula, v.daysLate, Number(v.montant || 0));
          if (fee > 0) {
            const message = buildTontineMessage("fee_applied", { name: name0, gender: gender0, fee, days_late: v.daysLate, amount: Number(v.montant || 0) });
            await logAction(rule.id, conn.id, "late_fee_applied", target, "ok", { fee, daysLate: v.daysLate, pax_id, montant: v.montant, message });
            summary.late_fees++;
          }
        }
      }
      summary.pax_in_late = byPax.size;
      const threshold = Number(policy.after_late_count || 3);
      const action = String(policy.action || "alert_only");
      for (const [pax_id, vers] of byPax) {
        if (Date.now() >= deadline) throw new Error("budget_exceeded");
        if (vers.length < threshold) continue;
        const target = `pax_block:${pax_id}:${today.toISOString().slice(0, 10)}`;
        if (await alreadyDone(rule.id, "pax_blocked", target)) continue;
        const { data: profs } = await r.select(t_profiles, { filters: { id: pax_id }, limit: 1 });
        const p = profs?.[0];
        const name = p ? `${p.prenom || ""} ${p.nom || ""}`.trim() : pax_id;
        const gender = (p?.genre || p?.sexe || "unknown") as Gender;
        const message = buildTontineMessage("block_warning", { name, gender, days_late: vers.length });
        const sent = await dispatchNotify(`Tontine — alerte ${name}`, message, p);
        await emitEvent(conn.id, "tontine_block", `Pax en retard répété: ${name}`,
          action === "alert_only" ? "warn" : "critical",
          message,
          { pax_id, late_count: vers.length, action, message, sent });
        await logAction(rule.id, conn.id, "pax_blocked", target, "ok", { action, late_count: vers.length, name, message, sent });
        summary.blocked++;
      }
      return { summary: { late_fees: summary.late_fees, blocked: summary.blocked, pax_in_late: summary.pax_in_late } };
    });
    phases.late_detection = res.status;
    if (res.status !== "done") summary.errors++;
  }

  if (wanted.has("congrats")) {
    const res = await runPhase(rule, conn, "congrats", deadline, async () => {
      const cp = rule.congrats_policy || {};
      if (!cp.enabled) return { summary: { skipped: true } };
      const daysBefore = Number(cp.days_before || 1);
      const target = new Date(); target.setDate(target.getDate() + daysBefore);
      const ymd = target.toISOString().slice(0, 10);
      const { data: payouts } = await r.select(t_pax_groups, { filters: { date_sortie: ymd }, limit: 200 });
      for (const p of payouts ?? []) {
        if (Date.now() >= deadline) throw new Error("budget_exceeded");
        const tref = `congrats:${p.id}`;
        if (await alreadyDone(rule.id, "congrats_sent", tref)) continue;
        const { data: profs } = await r.select(t_profiles, { filters: { id: p.pax_id }, limit: 1 });
        const prof = profs?.[0];
        const name = prof ? `${prof.prenom || ""} ${prof.nom || ""}`.trim() : "Pax";
        const gender = (prof?.genre || prof?.sexe || "unknown") as Gender;
        const text = buildTontineMessage("congrats", { name, gender, date_sortie: ymd });
        const sent = await dispatchNotify(`Tontine — sortie ${name}`, text, prof);
        await emitEvent(conn.id, "tontine_congrats", `Félicitations préparées pour ${name}`, "info", text,
          { pax_group_id: p.id, pax_id: p.pax_id, group_id: p.group_id, channel: cp.channel || "all", date_sortie: ymd, message: text, sent });
        await logAction(rule.id, conn.id, "congrats_sent", tref, "ok", { name, channel: cp.channel, message: text, sent });
        summary.congrats++;
      }
      return { summary: { congrats: summary.congrats } };
    });
    phases.congrats = res.status;
    if (res.status !== "done") summary.errors++;
  }

  if (wanted.has("receipts")) {
    const res = await runPhase(rule, conn, "receipts", deadline, async () => {
      const rp = rule.receipt_policy || {};
      if (!rp.enabled) return { summary: { skipped: true } };
      const { data: validated } = await r.select(t_versements, { filters: { statut: "valide_admin" }, limit: 500 });
      const { data: recus } = await r.select(t_recus, { limit: 1000 });
      const recuByVers = new Set((recus ?? []).map((x: any) => x.versement_id));
      for (const v of validated ?? []) {
        if (Date.now() >= deadline) throw new Error("budget_exceeded");
        if (recuByVers.has(v.id)) continue;
        const tref = `receipt_pending:${v.id}`;
        if (await alreadyDone(rule.id, "receipt_pending", tref)) continue;
        await emitEvent(conn.id, "tontine_receipt_pending", `Reçu manquant pour versement validé`, "info",
          `Versement ${v.id} de ${v.montant} F validé mais aucun reçu généré`,
          { versement_id: v.id, pax_id: v.pax_id, montant: v.montant });
        await logAction(rule.id, conn.id, "receipt_pending", tref, "ok", { include_qr: !!rp.include_qr });
        summary.receipts++;
      }
      return { summary: { receipts: summary.receipts } };
    });
    phases.receipts = res.status;
    if (res.status !== "done") summary.errors++;
  }

  return { ...summary, phases };
}

async function resumeAll() {
  const sb = admin();
  const { data: rules } = await sb.from("tontine_rules").select("*").eq("enabled", true);
  const out: any[] = [];
  const globalDeadline = Date.now() + PHASE_BUDGET_MS;
  for (const rule of rules ?? []) {
    if (Date.now() >= globalDeadline) { out.push({ rule_id: rule.id, deferred: true }); continue; }
    const { data: conn } = await sb.from("app_connections").select("*").eq("id", rule.app_connection_id).maybeSingle();
    if (!conn) continue;
    const { data: cps } = await sb.from("tontine_checkpoints").select("phase,status").eq("rule_id", rule.id);
    const todo = ["late_detection", "congrats", "receipts"].filter((ph) => {
      const cp = (cps ?? []).find((x: any) => x.phase === ph);
      return !cp || cp.status !== "done";
    });
    if (!todo.length) { out.push({ rule_id: rule.id, name: rule.name, resumed: false, reason: "all_done" }); continue; }
    try {
      const summary = await runEngineForRule(rule as Rule, conn as AppConn, { phases: todo, deadline: globalDeadline });
      out.push({ rule_id: rule.id, name: rule.name, resumed: todo, summary });
    } catch (e) {
      out.push({ rule_id: rule.id, error: (e as Error).message });
    }
  }
  return out;
}

async function resetCheckpoints(rule_id?: string) {
  const q = admin().from("tontine_checkpoints").delete();
  const { error } = rule_id ? await q.eq("rule_id", rule_id) : await q.neq("id", "00000000-0000-0000-0000-000000000000");
  return { ok: !error, error: error?.message };
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { action, rule_id } = body;
    const sb = admin();

    if (action === "run_one" && rule_id) {
      const { data: rule } = await sb.from("tontine_rules").select("*").eq("id", rule_id).maybeSingle();
      if (!rule) throw new Error("Règle introuvable");
      const { data: conn } = await sb.from("app_connections").select("*").eq("id", rule.app_connection_id).maybeSingle();
      if (!conn) throw new Error("Connexion app introuvable");
      const summary = await runEngineForRule(rule as Rule, conn as AppConn);
      return new Response(JSON.stringify({ ok: true, summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "run_all") {
      const { data: rules } = await sb.from("tontine_rules").select("*").eq("enabled", true);
      const out: any[] = [];
      for (const rule of rules ?? []) {
        const { data: conn } = await sb.from("app_connections").select("*").eq("id", rule.app_connection_id).maybeSingle();
        if (!conn) continue;
        try {
          const summary = await runEngineForRule(rule as Rule, conn as AppConn);
          out.push({ rule_id: rule.id, name: rule.name, summary });
        } catch (e) { out.push({ rule_id: rule.id, error: (e as Error).message }); }
      }
      return new Response(JSON.stringify({ ok: true, results: out }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "preview_fee") {
      const fee = computeLateFee(body.formula, Number(body.days_late || 0), Number(body.base_amount || 0));
      return new Response(JSON.stringify({ fee }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "preview_message") {
      const message = buildTontineMessage(body.kind, body.ctx || {});
      return new Response(JSON.stringify({ message }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "cascade_ai") {
      const res = await aiText({ prompt: body.prompt || "", system: body.system, maxTokens: body.maxTokens });
      return new Response(JSON.stringify({ ...publicResult(res), _debug: { attempts: res.attempts, provider_used: res.provider_used } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "cascade_notify") {
      const res = await notify(body);
      return new Response(JSON.stringify({ ...publicResult(res), _debug: { attempts: res.attempts, provider_used: res.provider_used } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "cascade_tts") {
      const res = await tts({ text: body.text || "", voice: body.voice });
      return new Response(JSON.stringify({ ...publicResult(res), _debug: { attempts: res.attempts, provider_used: res.provider_used } }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "resume_all") {
      const results = await resumeAll();
      return new Response(JSON.stringify({ ok: true, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "reset_checkpoints") {
      const r = await resetCheckpoints(body.rule_id);
      return new Response(JSON.stringify(r), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "phase_status") {
      const q = sb.from("tontine_checkpoints").select("*");
      const { data } = await (body.rule_id ? q.eq("rule_id", body.rule_id) : q);
      return new Response(JSON.stringify({ ok: true, checkpoints: data ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list_rules") {
      const { data, error } = await sb.from("tontine_rules")
        .select("id,name,enabled,app_connection_id,block_policy,late_fee_formula,table_mapping,created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, rules: data ?? [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list_late_pax" && body.rule_id) {
      const { data: rule } = await sb.from("tontine_rules").select("*").eq("id", body.rule_id).maybeSingle();
      if (!rule) throw new Error("Règle introuvable");
      const { data: conn } = await sb.from("app_connections").select("*").eq("id", rule.app_connection_id).maybeSingle();
      if (!conn) throw new Error("Connexion app introuvable");
      const r = buildRemote(conn as AppConn);
      const map = (rule as any).table_mapping || {};
      const t_versements = map.versements || "versements";
      const t_profiles = map.profiles || "profiles";
      const lateAfterDays = Number((rule as any).block_policy?.late_after_days ?? (rule as any).block_policy?.after_late_count ?? 2);
      const { data: pending, error: errV } = await r.select(t_versements, { filters: { statut: "en_attente" }, limit: 1000 });
      if (errV) throw new Error(`lecture_versements: ${errV}`);
      const now = Date.now();
      const byPax = new Map<string, any[]>();
      for (const v of pending || []) {
        const days = v.created_at ? Math.floor((now - new Date(v.created_at).getTime()) / 86400000) : 0;
        if (days >= lateAfterDays) {
          if (!byPax.has(v.pax_id)) byPax.set(v.pax_id, []);
          byPax.get(v.pax_id)!.push({ id: v.id, montant: v.montant, statut: v.statut, days_late: days, created_at: v.created_at });
        }
      }
      const late_pax: any[] = [];
      for (const [pax_id, vers] of byPax) {
        const { data: profs } = await r.select(t_profiles, { filters: { id: pax_id }, limit: 1 });
        const p = profs?.[0];
        late_pax.push({
          pax_id,
          nom_complet: p ? `${p.prenom || ""} ${p.nom || ""}`.trim() : null,
          telephone: p?.telephone || null,
          nb_versements_en_retard: vers.length,
          montant_total_du: vers.reduce((s: number, v: any) => s + Number(v.montant || 0), 0),
          versements: vers,
        });
      }
      late_pax.sort((a, b) => b.montant_total_du - a.montant_total_du);
      return new Response(JSON.stringify({
        ok: true,
        tontine: (rule as any).name,
        late_after_days: lateAfterDays,
        total: late_pax.length,
        late_pax,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "action inconnue" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cyounne-tontine error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
