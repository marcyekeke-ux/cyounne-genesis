import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function AdminReports() {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ type: "quotidien", title: "", facts: "" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const generate = async () => {
    if (!form.title) { toast.error("Titre requis"); return; }
    if (!form.facts) { toast.error("Aucun fait fourni : impossible de produire un rapport"); return; }
    setBusy(true);
    try {
      // demande à Cyounne de structurer un rapport SUR LES FAITS FOURNIS uniquement
      const { data, error } = await supabase.functions.invoke("cyounne-chat", {
        body: {
          isAdmin: true, gender: "XY",
          messages: [{
            role: "user",
            content: `Génère un rapport ${form.type} structuré en français basé UNIQUEMENT sur ces faits réels (n'invente rien) :\n\n${form.facts}\n\nFormat : 1) Faits réels 2) Analyse 3) Causes 4) Conséquences 5) Recommandations.`,
          }],
        },
      });
      if (error) throw error;
      const content = (data as any)?.content ?? "Aucune donnée exploitable disponible";
      const { error: insErr } = await supabase.from("reports").insert({
        type: form.type,
        title: form.title,
        content: { body: content, facts: form.facts },
        generated_by: user?.id,
      });
      if (insErr) throw insErr;
      toast.success("Rapport généré");
      setForm({ type: "quotidien", title: "", facts: "" });
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const downloadPdf = (r: any) => {
    // simple fallback : .txt téléchargeable (un vrai PDF nécessiterait Brevo + lib)
    const txt = `# ${r.title}\nType: ${r.type}\nDate: ${new Date(r.created_at).toLocaleString("fr-FR")}\n\n${(r.content?.body ?? "")}\n\n---\nFaits source:\n${r.content?.facts ?? ""}`;
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${r.title}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-5xl">
      <header className="flex items-center gap-3">
        <FileText className="w-7 h-7 text-accent" />
        <div>
          <h1 className="font-display text-3xl font-black text-gradient">Rapports</h1>
          <p className="text-sm text-muted-foreground">Faits réels uniquement. Aucune invention.</p>
        </div>
      </header>

      <Card className="glass p-5 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="bg-background border border-border/60 rounded-md px-3 py-2 text-sm">
            <option value="quotidien">Quotidien</option>
            <option value="hebdomadaire">Hebdomadaire</option>
            <option value="mensuel">Mensuel</option>
            <option value="incident">Incident</option>
            <option value="strategique">Stratégique</option>
          </select>
          <Input placeholder="Titre du rapport" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <Textarea
          rows={6}
          placeholder="Collez ici uniquement des FAITS RÉELS observés (chiffres, événements, comportements). Cyounne refusera d'inventer."
          value={form.facts}
          onChange={(e) => setForm({ ...form, facts: e.target.value })}
        />
        <div className="flex justify-end">
          <Button onClick={generate} disabled={busy} className="bg-gradient-primary">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />} Générer
          </Button>
        </div>
      </Card>

      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id} className="glass p-4">
            <div className="flex justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-accent">{r.type}</div>
                <h3 className="font-bold">{r.title}</h3>
                <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(r.created_at).toLocaleString("fr-FR")}</div>
              </div>
              <Button size="sm" variant="outline" onClick={() => downloadPdf(r)}>Télécharger</Button>
            </div>
            <pre className="mt-3 text-xs whitespace-pre-wrap text-muted-foreground bg-background/30 p-3 rounded-lg max-h-60 overflow-auto">{r.content?.body}</pre>
          </Card>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun rapport.</p>}
      </div>
    </div>
  );
}
