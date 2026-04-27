import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { BookOpen, Plus, CheckCircle2, Trash2 } from "lucide-react";

export default function AdminKnowledge() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ category: "", title: "", content: "", tags: "" });

  const load = async () => {
    const { data } = await supabase.from("knowledge").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.title || !form.content || !form.category) { toast.error("Catégorie, titre et contenu requis"); return; }
    const { error } = await supabase.from("knowledge").insert({
      category: form.category,
      title: form.title,
      content: form.content,
      tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
      validated: false,
    });
    if (error) toast.error(error.message);
    else { toast.success("Connaissance ajoutée"); setForm({ category: "", title: "", content: "", tags: "" }); load(); }
  };

  const validate = async (id: string) => {
    await supabase.from("knowledge").update({ validated: true }).eq("id", id);
    toast.success("Validé");
    load();
  };

  const del = async (id: string) => {
    await supabase.from("knowledge").delete().eq("id", id);
    load();
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-5xl">
      <header className="flex items-center gap-3">
        <BookOpen className="w-7 h-7 text-accent" />
        <div>
          <h1 className="font-display text-3xl font-black text-gradient">Connaissances</h1>
          <p className="text-sm text-muted-foreground">Enrichissez Cyounne. Apprentissage instantané après validation.</p>
        </div>
      </header>

      <Card className="glass p-5 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <Input placeholder="Catégorie (ex: services, paxage)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <Input placeholder="Titre" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <Textarea placeholder="Contenu / règle / concept" rows={4} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        <Input placeholder="Tags séparés par virgule" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        <div className="flex justify-end">
          <Button onClick={add} className="bg-gradient-primary"><Plus className="w-4 h-4 mr-1" /> Ajouter</Button>
        </div>
      </Card>

      <div className="space-y-3">
        {rows.map((r) => (
          <Card key={r.id} className="glass p-4 flex gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-widest text-accent">{r.category}</span>
                <h3 className="font-bold text-sm">{r.title}</h3>
                {r.validated ? <span className="text-[10px] text-success">✓ validé</span> : <span className="text-[10px] text-warning">en attente</span>}
              </div>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{r.content}</p>
              {r.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {r.tags.map((t: string) => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary/60">{t}</span>)}
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {!r.validated && <Button size="sm" onClick={() => validate(r.id)} variant="outline"><CheckCircle2 className="w-4 h-4" /></Button>}
              <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
