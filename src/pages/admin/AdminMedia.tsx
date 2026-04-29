import { useEffect, useRef, useState } from "react";
import { invokeCyounneAdmin } from "@/lib/cyounneAdmin";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Image as ImageIcon, Upload, Trash2, Loader2 } from "lucide-react";

const CATEGORIES = ["mr_ekeke", "logo_emr", "membres", "videos_officielles", "musiques_emr", "documents", "autres"];

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const s = reader.result as string;
      resolve(s.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AdminMedia() {
  const [rows, setRows] = useState<any[]>([]);
  const [category, setCategory] = useState("autres");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const res = await invokeCyounneAdmin<{ data: any[] }>("select", {
        table: "media_assets", order: { column: "created_at", ascending: false },
      });
      setRows(res.data ?? []);
    } catch (e: any) { toast.error(e?.message); }
  };
  useEffect(() => { load(); }, []);

  const upload = async (file: File) => {
    if (!label) { toast.error("Donnez un label avant d'uploader"); return; }
    setBusy(true);
    try {
      const path = `${category}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const base64 = await fileToBase64(file);
      const upRes = await invokeCyounneAdmin<{ publicUrl: string }>("storage_upload", {
        bucket: "media", path, base64, contentType: file.type,
      });
      await invokeCyounneAdmin("insert", {
        table: "media_assets",
        values: {
          category, label, url: upRes.publicUrl, mime_type: file.type,
          metadata: { size: file.size, name: file.name, path },
        },
      });
      toast.success("Média ajouté. Cyounne le reconnaît.");
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
    try {
      await invokeCyounneAdmin("delete", { table: "media_assets", match: { id: row.id } });
      load();
    } catch (e: any) { toast.error(e?.message); }
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-6xl">
      <header className="flex items-center gap-3">
        <ImageIcon className="w-7 h-7 text-accent" />
        <div>
          <h1 className="font-display text-3xl font-black text-gradient">Médias</h1>
          <p className="text-sm text-muted-foreground">Photos Mr ÉKÉKÉ, logo EMR, membres, vidéos, musiques. Cyounne reconnaît tout ce qui est uploadé.</p>
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
