import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Play, Plus, Trash2, Save } from "lucide-react";

type Conn = { id: string; name: string };
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

const DEFAULT_RULE: Omit<Rule, "id"> = {
  app_connection_id: "",
  name: "Règles standard",
  enabled: true,
  late_fee_formula: { type: "fixed_per_day", value: 500 },
  block_policy: { after_late_count: 3, action: "alert_only" },
  congrats_policy: { enabled: true, days_before: 1, channel: "all", template: "Yoh {name} 🎉 Demain c'est ta sortie tontine. Sois prêt(e) !" },
  receipt_policy: { enabled: true, auto_send: true, include_qr: true },
  table_mapping: { contributions: "contributions", members: "members", payouts: "payouts", late_fees: "late_fees" },
};

export default function AdminTontineRules() {
  const [conns, setConns] = useState<Conn[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: r }] = await Promise.all([
      supabase.from("app_connections").select("id,name").order("created_at"),
      supabase.from("tontine_rules" as any).select("*").order("created_at", { ascending: false }),
    ]);
    setConns((c as Conn[]) ?? []);
    setRules(((r as unknown) as Rule[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addRule = async () => {
    if (conns.length === 0) { toast.error("Connecte d'abord une application dans Sync multi-apps"); return; }
    const { error } = await supabase.from("tontine_rules" as any).insert({ ...DEFAULT_RULE, app_connection_id: conns[0].id });
    if (error) { toast.error(error.message); return; }
    toast.success("Règle créée");
    load();
  };

  const saveRule = async (rule: Rule) => {
    const { error } = await supabase.from("tontine_rules" as any).update({
      name: rule.name, enabled: rule.enabled, app_connection_id: rule.app_connection_id,
      late_fee_formula: rule.late_fee_formula, block_policy: rule.block_policy,
      congrats_policy: rule.congrats_policy, receipt_policy: rule.receipt_policy, table_mapping: rule.table_mapping,
    }).eq("id", rule.id);
    if (error) toast.error(error.message); else toast.success("Règle enregistrée");
  };

  const deleteRule = async (id: string) => {
    await supabase.from("tontine_rules" as any).delete().eq("id", id);
    toast.success("Règle supprimée"); load();
  };

  const runOne = async (id: string) => {
    setRunning(id);
    const { data, error } = await supabase.functions.invoke("cyounne-tontine", { body: { action: "run_one", rule_id: id } });
    setRunning(null);
    if (error) toast.error(error.message);
    else toast.success(`Exécuté: ${JSON.stringify((data as any)?.summary || {})}`);
  };

  const runAll = async () => {
    setRunning("all");
    const { error } = await supabase.functions.invoke("cyounne-tontine", { body: { action: "run_all" } });
    setRunning(null);
    if (error) toast.error(error.message); else toast.success("Toutes les règles exécutées");
  };

  const update = (id: string, patch: Partial<Rule>) => {
    setRules((rs) => rs.map((r) => r.id === id ? { ...r, ...patch } : r));
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Règles automatiques Tontines</h1>
          <p className="text-sm text-muted-foreground">Frais de retard, blocage, félicitations, reçus — configurables par tontine.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={addRule}><Plus className="w-4 h-4 mr-2" />Nouvelle règle</Button>
          <Button variant="secondary" onClick={runAll} disabled={running === "all"}>
            {running === "all" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Exécuter tout
          </Button>
        </div>
      </div>

      {loading && <Loader2 className="w-5 h-5 animate-spin" />}
      {!loading && rules.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">Aucune règle. Crée-en une pour démarrer le moteur Cyounne.</Card>
      )}

      <div className="grid gap-4">
        {rules.map((r) => (
          <Card key={r.id} className="p-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Input className="max-w-xs" value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} />
              <Select value={r.app_connection_id} onValueChange={(v) => update(r.id, { app_connection_id: v })}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>{conns.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex items-center gap-2 ml-auto">
                <Switch checked={r.enabled} onCheckedChange={(v) => update(r.id, { enabled: v })} />
                <Badge variant={r.enabled ? "default" : "secondary"}>{r.enabled ? "actif" : "off"}</Badge>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Frais de retard</h3>
                <Select value={r.late_fee_formula?.type || "fixed_per_day"} onValueChange={(v) => update(r.id, { late_fee_formula: { ...r.late_fee_formula, type: v } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed_per_day">Fixe par jour</SelectItem>
                    <SelectItem value="percent_per_week">Pourcentage par semaine</SelectItem>
                    <SelectItem value="tiered">Barème progressif</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" placeholder="Valeur" value={r.late_fee_formula?.value ?? ""} onChange={(e) => update(r.id, { late_fee_formula: { ...r.late_fee_formula, value: Number(e.target.value) } })} />
                {r.late_fee_formula?.type === "tiered" && (
                  <Textarea rows={3} placeholder='[{"from_day":1,"to_day":3,"amount":500},{"from_day":4,"to_day":7,"amount":2000}]'
                    value={JSON.stringify(r.late_fee_formula?.tiers ?? [])}
                    onChange={(e) => { try { update(r.id, { late_fee_formula: { ...r.late_fee_formula, tiers: JSON.parse(e.target.value) } }); } catch {} }} />
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Blocage après N retards</h3>
                <Input type="number" placeholder="Seuil retards" value={r.block_policy?.after_late_count ?? 3} onChange={(e) => update(r.id, { block_policy: { ...r.block_policy, after_late_count: Number(e.target.value) } })} />
                <Select value={r.block_policy?.action || "alert_only"} onValueChange={(v) => update(r.id, { block_policy: { ...r.block_policy, action: v } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alert_only">Alerter Admin seulement</SelectItem>
                    <SelectItem value="skip_next">Sauter prochaine sortie</SelectItem>
                    <SelectItem value="block_all">Bloquer toute participation</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Félicitations veille</h3>
                <div className="flex items-center gap-2">
                  <Switch checked={!!r.congrats_policy?.enabled} onCheckedChange={(v) => update(r.id, { congrats_policy: { ...r.congrats_policy, enabled: v } })} />
                  <Input type="number" className="w-20" value={r.congrats_policy?.days_before ?? 1} onChange={(e) => update(r.id, { congrats_policy: { ...r.congrats_policy, days_before: Number(e.target.value) } })} />
                  <span className="text-xs text-muted-foreground">jour(s) avant</span>
                </div>
                <Select value={r.congrats_policy?.channel || "all"} onValueChange={(v) => update(r.id, { congrats_policy: { ...r.congrats_policy, channel: v } })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous canaux</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="push">Push</SelectItem>
                  </SelectContent>
                </Select>
                <Textarea rows={2} value={r.congrats_policy?.template || ""} onChange={(e) => update(r.id, { congrats_policy: { ...r.congrats_policy, template: e.target.value } })} />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Reçu PDF de sortie</h3>
                <div className="flex items-center gap-2">
                  <Switch checked={!!r.receipt_policy?.enabled} onCheckedChange={(v) => update(r.id, { receipt_policy: { ...r.receipt_policy, enabled: v } })} />
                  <span className="text-xs">Activé</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={!!r.receipt_policy?.auto_send} onCheckedChange={(v) => update(r.id, { receipt_policy: { ...r.receipt_policy, auto_send: v } })} />
                  <span className="text-xs">Envoi auto</span>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={!!r.receipt_policy?.include_qr} onCheckedChange={(v) => update(r.id, { receipt_policy: { ...r.receipt_policy, include_qr: v } })} />
                  <span className="text-xs">Inclure QR code</span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-semibold">Mapping tables distantes (JSON)</h3>
              <Textarea rows={2} value={JSON.stringify(r.table_mapping ?? {})}
                onChange={(e) => { try { update(r.id, { table_mapping: JSON.parse(e.target.value) }); } catch {} }} />
              <p className="text-xs text-muted-foreground">Clés attendues : contributions, members, payouts, late_fees</p>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => deleteRule(r.id)}><Trash2 className="w-4 h-4 mr-2" />Supprimer</Button>
              <Button variant="outline" onClick={() => runOne(r.id)} disabled={running === r.id}>
                {running === r.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                Exécuter
              </Button>
              <Button onClick={() => saveRule(r)}><Save className="w-4 h-4 mr-2" />Enregistrer</Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
