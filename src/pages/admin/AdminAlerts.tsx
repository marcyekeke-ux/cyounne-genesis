import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, AlertCircle, AlertOctagon, CheckCircle2 } from "lucide-react";

const LEVEL_META: Record<string, { icon: any; cls: string; label: string }> = {
  leger: { icon: AlertTriangle, cls: "text-warning", label: "Niveau 1 — Léger" },
  moyen: { icon: AlertCircle, cls: "text-orange-400", label: "Niveau 2 — Moyen" },
  grave: { icon: AlertOctagon, cls: "text-destructive", label: "Niveau 3 — Grave" },
};

export default function AdminAlerts() {
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    const { data } = await supabase.from("alerts").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const resolve = async (id: string) => {
    await supabase.from("alerts").update({ resolved: true }).eq("id", id);
    load();
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-5xl">
      <header className="flex items-center gap-3">
        <Bell className="w-7 h-7 text-accent" />
        <div>
          <h1 className="font-display text-3xl font-black text-gradient">Alertes</h1>
          <p className="text-sm text-muted-foreground">Surveillance continue · 3 niveaux de gravité</p>
        </div>
      </header>

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
                <Button size="sm" variant="outline" onClick={() => resolve(r.id)}>
                  <CheckCircle2 className="w-4 h-4" />
                </Button>
              )}
            </Card>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-12">Aucune alerte. Tout est calme.</p>}
      </div>
    </div>
  );
}
