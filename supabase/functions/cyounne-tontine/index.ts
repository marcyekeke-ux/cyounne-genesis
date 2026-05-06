// Cyounne Tontine Engine — Lot 8B
// Applique les règles configurables par tontine: frais de retard, blocage, félicitations veille, reçu PDF
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildRemote, type AppConn } from "../_shared/remoteApp.ts";

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

type Conn = {
  id: string;
  name: string;
  supabase_url: string;
  supabase_anon_key: string;
  service_role_key: string | null;
};

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function remote(conn: AppConn) {
  return buildRemote(conn);
}

function computeLateFee(formula: any, daysLate: number, baseAmount = 0): number {
  if (daysLate <= 0) return 0;
  switch (formula?.type) {
    case "fixed_per_day":
      return Number(formula.value || 0) * daysLate;
    case "percent_per_week":
      return Math.ceil(daysLate / 7) * (baseAmount * Number(formula.value || 0) / 100);
    case "tiered": {
      const tiers = Array.isArray(formula.tiers) ? formula.tiers : [];
      const t = tiers.find((x: any) => daysLate >= x.from_day && daysLate <= x.to_day);
      return Number(t?.amount || 0);
    }
    default:
      return 0;
  }
}

async function logAction(rule_id: string | null, app_id: string | null, action_type: string, target: string | null, status: string, details: any) {
  try {
    await admin().from("tontine_actions").insert({
      rule_id, app_connection_id: app_id, action_type, target_ref: target, status, details,
    });
  } catch (e) {
    console.warn("logAction failed", (e as Error).message);
  }
}

async function emitEvent(app_id: string | null, type: string, title: string, severity = "info", description?: string, payload: any = {}) {
  try {
    await admin().from("agent_events").insert({
      app_connection_id: app_id, event_type: type, title, severity, description, payload,
    });
  } catch (_) {}
}

async function runEngineForRule(rule: Rule, conn: Conn) {
  const map = rule.table_mapping || {};
  const t_contrib = map.contributions || "contributions";
  const t_members = map.members || "members";
  const t_payouts = map.payouts || "payouts";
  const t_fees = map.late_fees || "late_fees";

  const r = remote(conn);
  const summary = { late_fees: 0, blocked: 0, congrats: 0, receipts: 0, errors: 0 };

  // 1) Frais de retard sur cotisations en retard non réglées
  try {
    const today = new Date();
    const { data: lateRows, error } = await r
      .from(t_contrib)
      .select("*")
      .eq("status", "late")
      .is("late_fee_applied_at", null)
      .limit(500);

    if (error) throw error;

    for (const row of lateRows ?? []) {
      const due = row.due_date ? new Date(row.due_date) : null;
      const daysLate = due ? Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000)) : 0;
      const fee = computeLateFee(rule.late_fee_formula, daysLate, Number(row.amount || 0));
      if (fee > 0) {
        const ins = await r.from(t_fees).insert({
          contribution_id: row.id,
          member_id: row.member_id,
          amount: fee,
          days_late: daysLate,
          rule_id: rule.id,
          created_at: new Date().toISOString(),
        });
        if (ins.error) throw ins.error;
        await r.from(t_contrib).update({ late_fee_applied_at: new Date().toISOString(), late_fee_amount: fee }).eq("id", row.id);
        summary.late_fees++;
        await logAction(rule.id, conn.id, "late_fee_applied", String(row.id), "ok", { fee, daysLate });
      }
    }
  } catch (e) {
    summary.errors++;
    await emitEvent(conn.id, "tontine_late_fee_error", "Erreur calcul frais retard", "warn", (e as Error).message);
  }

  // 2) Blocage après N retards
  try {
    const policy = rule.block_policy || {};
    const threshold = Number(policy.after_late_count || 3);
    const action = String(policy.action || "alert_only");

    const { data: members } = await r.from(t_members).select("id, full_name, late_count, status").gte("late_count", threshold).limit(500);
    for (const m of members ?? []) {
      if (action === "block_all") {
        await r.from(t_members).update({ status: "blocked", blocked_at: new Date().toISOString(), blocked_by_rule: rule.id }).eq("id", m.id);
      } else if (action === "skip_next") {
        await r.from(t_members).update({ skip_next_payout: true }).eq("id", m.id);
      }
      await emitEvent(conn.id, "tontine_block", `Pax en retard: ${m.full_name}`, action === "alert_only" ? "info" : "warn",
        `${m.late_count} retards — action: ${action}`, { member_id: m.id });
      await logAction(rule.id, conn.id, "pax_blocked", String(m.id), "ok", { action, late_count: m.late_count });
      summary.blocked++;
    }
  } catch (e) {
    summary.errors++;
    await emitEvent(conn.id, "tontine_block_error", "Erreur blocage pax", "warn", (e as Error).message);
  }

  // 3) Félicitations veille de sortie
  try {
    const cp = rule.congrats_policy || {};
    if (cp.enabled) {
      const daysBefore = Number(cp.days_before || 1);
      const target = new Date();
      target.setDate(target.getDate() + daysBefore);
      const ymd = target.toISOString().slice(0, 10);
      const { data: payouts } = await r.from(t_payouts).select("id, member_id, payout_date, congrats_sent_at").eq("payout_date", ymd).is("congrats_sent_at", null).limit(200);
      for (const p of payouts ?? []) {
        const { data: m } = await r.from(t_members).select("id, full_name, phone").eq("id", p.member_id).maybeSingle();
        const name = m?.full_name || "Pax";
        const text = String(cp.template || "Yoh {name} 🎉 Demain c'est ta sortie tontine.").replace("{name}", name);
        await emitEvent(conn.id, "tontine_congrats", `Félicitations préparées pour ${name}`, "info", text, { payout_id: p.id, channel: cp.channel || "all" });
        await r.from(t_payouts).update({ congrats_sent_at: new Date().toISOString() }).eq("id", p.id);
        await logAction(rule.id, conn.id, "congrats_sent", String(p.id), "ok", { name, channel: cp.channel });
        summary.congrats++;
      }
    }
  } catch (e) {
    summary.errors++;
    await emitEvent(conn.id, "tontine_congrats_error", "Erreur félicitations", "warn", (e as Error).message);
  }

  // 4) Reçus PDF (marqueurs — la génération réelle est faite par cyounne-doc à la demande)
  try {
    const rp = rule.receipt_policy || {};
    if (rp.enabled && rp.auto_send) {
      const { data: payouts } = await r.from(t_payouts).select("id, member_id").eq("status", "completed").is("receipt_generated_at", null).limit(200);
      for (const p of payouts ?? []) {
        await r.from(t_payouts).update({ receipt_generated_at: new Date().toISOString(), receipt_pending: true }).eq("id", p.id);
        await logAction(rule.id, conn.id, "receipt_generated", String(p.id), "ok", { include_qr: !!rp.include_qr });
        summary.receipts++;
      }
    }
  } catch (e) {
    summary.errors++;
    await emitEvent(conn.id, "tontine_receipt_error", "Erreur reçu PDF", "warn", (e as Error).message);
  }

  return summary;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action, rule_id, app_connection_id } = await req.json();
    const sb = admin();

    if (action === "run_one" && rule_id) {
      const { data: rule } = await sb.from("tontine_rules").select("*").eq("id", rule_id).maybeSingle();
      if (!rule) throw new Error("Règle introuvable");
      const { data: conn } = await sb.from("app_connections").select("*").eq("id", rule.app_connection_id).maybeSingle();
      if (!conn) throw new Error("Connexion app introuvable");
      const summary = await runEngineForRule(rule as Rule, conn as Conn);
      return new Response(JSON.stringify({ ok: true, summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "run_all") {
      const { data: rules } = await sb.from("tontine_rules").select("*").eq("enabled", true);
      const out: any[] = [];
      for (const rule of rules ?? []) {
        const { data: conn } = await sb.from("app_connections").select("*").eq("id", rule.app_connection_id).maybeSingle();
        if (!conn) continue;
        try {
          const summary = await runEngineForRule(rule as Rule, conn as Conn);
          out.push({ rule_id: rule.id, summary });
        } catch (e) {
          out.push({ rule_id: rule.id, error: (e as Error).message });
        }
      }
      return new Response(JSON.stringify({ ok: true, results: out }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "preview_fee") {
      const { formula, days_late, base_amount } = await req.json().catch(() => ({}));
      const fee = computeLateFee(formula, Number(days_late || 0), Number(base_amount || 0));
      return new Response(JSON.stringify({ fee }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "action inconnue" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cyounne-tontine error", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
