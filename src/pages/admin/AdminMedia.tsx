import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Image as ImageIcon, Upload, Trash2, Loader2 } from "lucide-react";

const CATEGORIES = ["mr_ekeke", "logo_emr", "membres", "videos_officielles", "musiques_emr", "documents", "autres"];

export default function AdminMedia() {
  const [rows, setRows] = useState<any[]>([]);
  const [category, setCategory] = useState("autres");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const { data } = await supabase.from("media_assets").select("*").order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const upload = async (file: File) => {
    if (!label) { toast.error("Donnez un label avant d'uploader"); return; }
    setBusy(true);
    try {
      const path = `${category}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("media").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
      const { error } = await supabase.from("media_assets").insert({
        category, label, url: publicUrl, mime_type: file.type, metadata: { size: file.size, name: file.name },
      });
      if (error) throw error;
      toast.success("Média ajouté");
      setLabel("");
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Upload échoué");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const del = async (row: any) => {
    await supabase.from("media_assets").delete().eq("id", row.id);
    load();
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-6xl">
      <header className="flex items-center gap-3">
        <ImageIcon className="w-7 h-7 text-accent" />
        <div>
          <h1 className="font-display text-3xl font-black text-gradient">Médias</h1>
          <p className="text-sm text-muted-foreground">Photos Mr EKEKE, logo EMR, membres, vidéos officielles, musiques. Cyounne reconnaît tout ce qui est uploadé.</p>
        </div>
      </header>

      <Card className="glass p-5 space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="bg-background border border-border/60 rounded-md px-3 py-2 text-sm">
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <Input placeholder="Label (ex: Logo EMR officiel)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <div>
            <input ref={fileRef} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <Button disabled={busy} onClick={() => fileRef.current?.click()} className="bg-gradient-primary w-full">
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} Téléverser
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {rows.map((r) => (
          <Card key={r.id} className="glass p-3 group">
            <div className="aspect-square rounded-lg overflow-hidden bg-secondary/40 mb-2 flex items-center justify-center">
              {r.mime_type?.startsWith("image/") ? (
                <img src={r.url} alt={r.label} className="w-full h-full object-cover" />
              ) : r.mime_type?.startsWith("video/") ? (
                <video src={r.url} className="w-full h-full object-cover" />
              ) : (
                <span className="text-xs text-muted-foreground">{r.mime_type}</span>
              )}
            </div>
            <div className="text-xs font-medium truncate">{r.label}</div>
            <div className="text-[10px] uppercase tracking-widest text-accent">{r.category}</div>
            <Button size="sm" variant="ghost" className="w-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => del(r)}>
              <Trash2 className="w-3 h-3 text-destructive" />
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
