import { useEffect, useState } from "react";
import { invokeCyounneAdmin } from "@/lib/cyounneAdmin";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bell, AlertTriangle, AlertCircle, AlertOctagon, CheckCircle2, Send, Loader2, BellRing } from "lucide-react";
import { toast } from "sonner";

const LEVEL_META: Record<string, { icon: any; cls: string; label: string }> = {
  leger: { icon: AlertTriangle, cls: "text-warning", label: "Niveau 1 — Léger" },
  moyen: { icon: AlertCircle, cls: "text-orange-400", label: "Niveau 2 — Moyen" },
  grave: { icon: AlertOctagon, cls: "text-destructive", label: "Niveau 3 — Grave" },
};

export default function AdminAlerts() {
  const [rows, setRows] = useState<any[]>([]);
  const [pushTitle, setPushTitle] = useState("Alerte Cyounne");
  const [pushMsg, setPushMsg] = useState("");
  const [pushUrl, setPushUrl] = useState("");
  const [pushBusy, setPushBusy] = useState(false);
  const [subs, setSubs] = useState<number>(0);

  const load = async () => {
    try {
      const [a, s] = await Promise.all([
        invokeCyounneAdmin<{ data: any[] }>("select", { table: "alerts", order: { column: "created_at", ascending: false } }),
        invokeCyounneAdmin<{ data: any[] }>("select", { table: "push_subscriptions" }),
      ]);
      setRows(a.data ?? []);
      setSubs(s.data?.length ?? 0);
    } catch (e: any) { toast.error(e?.message); }
  };
  useEffect(() => { load(); }, []);

  const resolve = async (id: string) => {
    try {
      await invokeCyounneAdmin("update", { table: "alerts", values: { resolved: true }, match: { id } });
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

  const sendPush = async (title?: string, message?: string) => {
    setPushBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push", {
        body: { title: title ?? pushTitle, message: message ?? pushMsg, url: pushUrl || undefined },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Push envoyée à ${(data as any)?.recipients ?? 0} destinataire(s)`);
      setPushMsg("");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur OneSignal");
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-5xl">
      <header className="flex items-center gap-3">
        <Bell className="w-7 h-7 text-accent" />
        <div>
          <h1 className="font-display text-3xl font-black text-gradient">Alertes &amp; Push</h1>
          <p className="text-sm text-muted-foreground">Surveillance Cyounne · {subs} appareil{subs > 1 ? "s" : ""} OneSignal abonné{subs > 1 ? "s" : ""}</p>
        </div>
      </header>

      <Card className="glass p-5 space-y-3">
        <div className="flex items-center gap-2">
          <BellRing className="w-5 h-5 text-accent" />
          <h2 className="font-display font-bold">Envoyer une notification push</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Input placeholder="Titre" value={pushTitle} onChange={(e) => setPushTitle(e.target.value)} />
          <Input placeholder="URL d'ouverture (optionnel)" value={pushUrl} onChange={(e) => setPushUrl(e.target.value)} className="md:col-span-2" />
        </div>
        <Textarea placeholder="Message à diffuser..." value={pushMsg} onChange={(e) => setPushMsg(e.target.value)} className="min-h-[80px]" />
        <div className="flex gap-2 justify-end">
          <Button variant="outline" disabled={pushBusy} onClick={() => sendPush("Test Cyounne", "Ceci est un test de notification.")}>
            Test
          </Button>
          <Button disabled={pushBusy || !pushMsg} onClick={() => sendPush()} className="bg-gradient-primary">
            {pushBusy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
            Envoyer à tous
          </Button>
        </div>
      </Card>

      <h2 className="font-display font-bold pt-2">Historique alertes</h2>
      <div className="space-y-2">
        {rows.map((r) => {
          const meta = LEVEL_META[r.level];
          const Icon = meta?.icon ?? Bell;
          return (
            <Card key={r.id} className={`glass p-4 flex items-start gap-3 ${r.resolved ? "opacity-50" : ""}`}>
              <Icon className={`w-5 h-5 mt-0.5 ${meta?.cls}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] uppercase tracking-widest ${meta?.cls}`}>{meta?.label}</span>
                  {r.source && <span className="text-[10px] text-muted-foreground">· {r.source}</span>}
                </div>
                <h3 className="font-bold text-sm mt-0.5">{r.title}</h3>
                {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                <div className="text-[10px] text-muted-foreground mt-2">{new Date(r.created_at).toLocaleString("fr-FR")}</div>
              </div>
              {!r.resolved && (
                <div className="flex flex-col gap-1">
                  <Button size="sm" variant="outline" onClick={() => sendPush(r.title, r.description ?? r.title)} title="Diffuser en push" disabled={pushBusy}>
                    <BellRing className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => resolve(r.id)} title="Marquer résolu">
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">Aucune alerte. Tout est calme.</p>}
      </div>
    </div>
  );
}
