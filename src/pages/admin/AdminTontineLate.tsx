import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Loader2, RefreshCw, AlertTriangle, Users, Send } from "lucide-react";
import { toast } from "sonner";

type Rule = { id: string; name: string; enabled: boolean; app_connection_id: string };
type Versement = { id: string; montant: number; statut: string; days_late: number; created_at: string };
type LatePax = {
  pax_id: string;
  nom_complet: string | null;
  telephone: string | null;
  nb_versements_en_retard: number;
  montant_total_du: number;
  versements: Versement[];
};
type LateResult = { tontine: string; late_after_days: number; total: number; late_pax: LatePax[] };

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n) + " FCFA";

export default function AdminTontineLate() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const [selected, setSelected] = useState<Rule | null>(null);
  const [loadingLate, setLoadingLate] = useState(false);
  const [result, setResult] = useState<LateResult | null>(null);
  const [selectedPax, setSelectedPax] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);

  const loadRules = async () => {
    setLoadingRules(true);
    try {
      const { data, error } = await supabase.functions.invoke("cyounne-tontine", { body: { action: "list_rules" } });
      if (error) throw error;
      setRules((data?.rules as Rule[]) ?? []);
    } catch (e: any) {
      toast.error(e.message || "Échec du chargement des tontines");
    } finally {
      setLoadingRules(false);
    }
  };

  const loadLate = async (rule: Rule) => {
    setSelected(rule);
    setResult(null);
    setSelectedPax(new Set());
    setLoadingLate(true);
    try {
      const { data, error } = await supabase.functions.invoke("cyounne-tontine", {
        body: { action: "list_late_pax", rule_id: rule.id },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Échec");
      setResult(data as LateResult);
    } catch (e: any) {
      toast.error(e.message || "Échec de la lecture des retards");
    } finally {
      setLoadingLate(false);
    }
  };

  useEffect(() => { loadRules(); }, []);

  const totalDu = result?.late_pax.reduce((s, p) => s + p.montant_total_du, 0) ?? 0;

  const togglePax = (pax_id: string) => {
    setSelectedPax((prev) => {
      const next = new Set(prev);
      if (next.has(pax_id)) next.delete(pax_id); else next.add(pax_id);
      return next;
    });
  };

  const eligible = useMemo(
    () => (result?.late_pax ?? []).filter((p) => !!p.telephone),
    [result],
  );
  const allSelected = eligible.length > 0 && eligible.every((p) => selectedPax.has(p.pax_id));

  const toggleAll = () => {
    if (allSelected) setSelectedPax(new Set());
    else setSelectedPax(new Set(eligible.map((p) => p.pax_id)));
  };

  const sendReminders = async () => {
    if (!selected || selectedPax.size === 0) return;
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("cyounne-tontine", {
        body: { action: "send_late_reminders", rule_id: selected.id, pax_ids: Array.from(selectedPax) },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || "Échec d'envoi");
      const { sent, total, results } = data as { sent: number; total: number; results: any[] };
      if (sent === total) toast.success(`Rappels WhatsApp envoyés à ${sent} pax`);
      else toast.warning(`${sent}/${total} envoyés. Vérifie les numéros manquants.`);
      const failed = results.filter((r) => !r.ok);
      if (failed.length) console.warn("Rappels échoués:", failed);
      setSelectedPax(new Set());
    } catch (e: any) {
      toast.error(e.message || "Échec de l'envoi des rappels");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tontines · Pax en retard</h1>
          <p className="text-sm text-muted-foreground">Données réelles lues en direct depuis EMR Tontines.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadRules} disabled={loadingRules}>
          {loadingRules ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="ml-2">Rafraîchir</span>
        </Button>
      </div>

      <Card className="p-4">
        <div className="text-sm font-medium mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-accent" /> Tontines configurées
        </div>
        {loadingRules ? (
          <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune tontine configurée. Va dans Règles tontines pour en créer une.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {rules.map((r) => (
              <button
                key={r.id}
                onClick={() => loadLate(r)}
                className={`text-left p-3 rounded-md border transition-colors hover:bg-secondary/60 ${selected?.id === r.id ? "border-accent bg-secondary/40" : "border-border"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{r.name}</span>
                  <Badge variant={r.enabled ? "default" : "secondary"} className="text-[10px]">
                    {r.enabled ? "active" : "off"}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 truncate">{r.id}</div>
              </button>
            ))}
          </div>
        )}
      </Card>

      {selected && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="font-medium">Retards · {selected.name}</span>
            </div>
            <div className="flex items-center gap-3">
              {result && (
                <div className="text-xs text-muted-foreground">
                  seuil {result.late_after_days}j · {result.total} pax · {fmt(totalDu)} dûs
                </div>
              )}
              <Button
                size="sm"
                onClick={sendReminders}
                disabled={sending || selectedPax.size === 0}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span className="ml-2">Envoyer rappel WhatsApp ({selectedPax.size})</span>
              </Button>
            </div>
          </div>

          {loadingLate ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : !result ? null : result.late_pax.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aucun pax en retard sur cette tontine 🎉</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Tout sélectionner" />
                  </TableHead>
                  <TableHead>Pax</TableHead>
                  <TableHead>Téléphone</TableHead>
                  <TableHead className="text-right">Versements</TableHead>
                  <TableHead className="text-right">Retard max</TableHead>
                  <TableHead className="text-right">Montant dû</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.late_pax.map((p) => {
                  const maxDays = Math.max(...p.versements.map((v) => v.days_late), 0);
                  const hasPhone = !!p.telephone;
                  return (
                    <TableRow key={p.pax_id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedPax.has(p.pax_id)}
                          onCheckedChange={() => togglePax(p.pax_id)}
                          disabled={!hasPhone}
                          aria-label={`Sélectionner ${p.nom_complet || p.pax_id}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{p.nom_complet || "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{p.pax_id}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {hasPhone ? p.telephone : <span className="text-muted-foreground italic">non renseigné</span>}
                      </TableCell>
                      <TableCell className="text-right">{p.nb_versements_en_retard}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={maxDays >= 7 ? "destructive" : "secondary"}>{maxDays}j</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">{fmt(p.montant_total_du)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
