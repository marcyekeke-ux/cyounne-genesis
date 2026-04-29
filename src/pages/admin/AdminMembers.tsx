import { useEffect, useState } from "react";
import { invokeCyounneAdmin } from "@/lib/cyounneAdmin";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Users, Plus, Ban, CheckCircle2, Trash2 } from "lucide-react";

type Level = "pax" | "mega_pax" | "super_pax" | "roi" | "reine";
type Status = "actif" | "bloque" | "suspendu";

const LEVELS: Level[] = ["pax", "mega_pax", "super_pax", "roi", "reine"];

export default function AdminMembers() {
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ pax_id: "", full_name: "", email: "", phone: "", level: "pax" as Level });
  const [search, setSearch] = useState("");

  const load = async () => {
    try {
      const res = await invokeCyounneAdmin<{ data: any[] }>("select", {
        table: "members", order: { column: "joined_at", ascending: false },
      });
      setRows(res.data ?? []);
    } catch (e: any) { toast.error(e?.message); }
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!form.pax_id || !form.full_name) { toast.error("PAX ID et nom requis"); return; }
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent("EMR-PAX-" + form.pax_id)}`;
    const avatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(form.pax_id)}`;
    try {
      await invokeCyounneAdmin("insert", {
        table: "members",
        values: { ...form, qr_code: qr, avatar_url: avatar },
      });
      toast.success("Membre ajouté");
      setForm({ pax_id: "", full_name: "", email: "", phone: "", level: "pax" });
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

  const setLevel = async (id: string, level: Level) => {
    try {
      await invokeCyounneAdmin("update", { table: "members", values: { level }, match: { id } });
      toast.success("Niveau mis à jour"); load();
    } catch (e: any) { toast.error(e?.message); }
  };

  const setStatus = async (id: string, status: Status) => {
    try {
      await invokeCyounneAdmin("update", { table: "members", values: { status }, match: { id } });
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

  const del = async (id: string) => {
    try {
      await invokeCyounneAdmin("delete", { table: "members", match: { id } });
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

  const filtered = rows.filter((r) =>
    !search ||
    r.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.pax_id?.toLowerCase().includes(search.toLowerCase()) ||
    r.email?.toLowerCase().includes(search.toLowerCase()),
  );

  const exportCsv = () => {
    const headers = ["pax_id", "full_name", "email", "phone", "level", "status", "trust_score", "cumul", "creances", "gages"];
    const lines = [headers.join(",")];
    for (const r of rows) lines.push(headers.map((h) => JSON.stringify(r[h] ?? "")).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `emr-members-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-6xl">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users className="w-7 h-7 text-accent" />
          <div>
            <h1 className="font-display text-3xl font-black text-gradient">Membres EMR</h1>
            <p className="text-sm text-muted-foreground">PAX, MEGA PAX, SUPER PAX, Roi, Reine</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
      </header>

      <Card className="glass p-5 space-y-3">
        <div className="grid md:grid-cols-5 gap-2">
          <Input placeholder="PAX ID" value={form.pax_id} onChange={(e) => setForm({ ...form, pax_id: e.target.value })} />
          <Input placeholder="Nom complet" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input placeholder="Téléphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as Level })} className="bg-background border border-border/60 rounded-md px-3 py-2 text-sm">
            {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
        <div className="flex justify-end">
          <Button onClick={add} className="bg-gradient-primary"><Plus className="w-4 h-4 mr-1" /> Ajouter membre</Button>
        </div>
      </Card>

      <Input placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)} />

      <div className="space-y-2">
        {filtered.map((r) => (
          <Card key={r.id} className="glass p-4 flex flex-col md:flex-row md:items-center gap-3">
            <img src={r.avatar_url} alt="" className="w-12 h-12 rounded-full bg-secondary" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{r.full_name}</div>
              <div className="text-xs text-muted-foreground font-mono">{r.pax_id} · {r.email ?? "—"} · {r.phone ?? "—"}</div>
              <div className="flex gap-2 mt-1 text-[10px] uppercase tracking-widest">
                <span className="text-accent">{r.level}</span>
                <span className={r.status === "actif" ? "text-success" : "text-destructive"}>{r.status}</span>
                <span className="text-muted-foreground">trust {r.trust_score}</span>
              </div>
            </div>
            <select value={r.level} onChange={(e) => setLevel(r.id, e.target.value as Level)} className="bg-background border border-border/60 rounded-md px-2 py-1 text-xs">
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
            {r.status === "actif" ? (
              <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "bloque")}><Ban className="w-3 h-3" /></Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "actif")}><CheckCircle2 className="w-3 h-3" /></Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => del(r.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucun membre.</p>}
      </div>
    </div>
  );
}
