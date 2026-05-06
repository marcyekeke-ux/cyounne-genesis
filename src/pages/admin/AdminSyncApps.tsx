import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, RefreshCw, Plus, Trash2, Activity } from "lucide-react";

type Conn = {
  id: string;
  name: string;
  app_type: string;
  supabase_url: string;
  enabled: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  schema_cache: any;
  connection_mode?: string | null;
  endpoint_url?: string | null;
  endpoint_header_name?: string | null;
};

type Event = {
  id: string;
  app_connection_id: string | null;
  event_type: string;
  severity: string;
  title: string;
  description: string | null;
  created_at: string;
};

export default function AdminSyncApps() {
  const [conns, setConns] = useState<Conn[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    mode: "edge_proxy" as "edge_proxy" | "supabase",
    supabase_url: "",
    supabase_anon_key: "",
    endpoint_url: "",
    endpoint_key: "",
    endpoint_header_name: "x-cyounne-key",
  });

  const load = async () => {
    setLoading(true);
    const [{ data: c }, { data: e }] = await Promise.all([
      supabase.from("app_connections").select("*").order("created_at", { ascending: false }),
      supabase.from("agent_events").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    setConns((c as Conn[]) ?? []);
    setEvents((e as Event[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("agent_events")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_events" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const addConn = async () => {
    if (!form.name) { toast.error("Le nom est requis"); return; }
    let payload: any = { name: form.name, connection_mode: form.mode };
    if (form.mode === "edge_proxy") {
      if (!form.endpoint_url || !form.endpoint_key) { toast.error("Endpoint et clé requis"); return; }
      payload = { ...payload, endpoint_url: form.endpoint_url, endpoint_key: form.endpoint_key, endpoint_header_name: form.endpoint_header_name || "x-cyounne-key", supabase_url: null, supabase_anon_key: null };
    } else {
      if (!form.supabase_url || !form.supabase_anon_key) { toast.error("URL Supabase et clé anon requises"); return; }
      payload = { ...payload, supabase_url: form.supabase_url, supabase_anon_key: form.supabase_anon_key };
    }
    const { error } = await supabase.from("app_connections").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Application ajoutée. Lancement du scan…");
    setForm({ name: "", mode: "edge_proxy", supabase_url: "", supabase_anon_key: "", endpoint_url: "", endpoint_key: "", endpoint_header_name: "x-cyounne-key" });
    await load();
    await scanAll();
  };

  const removeConn = async (id: string) => {
    await supabase.from("app_connections").delete().eq("id", id);
    toast.success("Application retirée");
    load();
  };

  const scanOne = async (id: string) => {
    setScanning(id);
    const { error } = await supabase.functions.invoke("cyounne-watcher", { body: { action: "scan_one", id } });
    setScanning(null);
    if (error) toast.error(error.message); else toast.success("Scan terminé");
    load();
  };

  const scanAll = async () => {
    setScanning("all");
    const { error } = await supabase.functions.invoke("cyounne-watcher", { body: { action: "scan_all" } });
    setScanning(null);
    if (error) toast.error(error.message); else toast.success("Scan global terminé");
    load();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sync multi-apps</h1>
          <p className="text-sm text-muted-foreground">Cyounne surveille en silence les bases Supabase de chaque application connectée.</p>
        </div>
        <Button onClick={scanAll} disabled={scanning === "all"}>
          {scanning === "all" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
          Scanner tout
        </Button>
      </div>

      <Card className="p-4 space-y-3">
        <h2 className="font-semibold">Ajouter une application</h2>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant={form.mode === "edge_proxy" ? "default" : "outline"} onClick={() => setForm({ ...form, mode: "edge_proxy" })}>Edge proxy (cyounne-agent)</Button>
          <Button size="sm" variant={form.mode === "supabase" ? "default" : "outline"} onClick={() => setForm({ ...form, mode: "supabase" })}>Supabase direct</Button>
        </div>
        <Input placeholder="Nom (ex: EMR Tontines)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        {form.mode === "edge_proxy" ? (
          <div className="grid md:grid-cols-3 gap-2">
            <Input placeholder="https://xxx.supabase.co/functions/v1/cyounne-agent" value={form.endpoint_url} onChange={(e) => setForm({ ...form, endpoint_url: e.target.value })} />
            <Input placeholder="x-cyounne-key (clé)" value={form.endpoint_key} onChange={(e) => setForm({ ...form, endpoint_key: e.target.value })} />
            <Input placeholder="Header (def: x-cyounne-key)" value={form.endpoint_header_name} onChange={(e) => setForm({ ...form, endpoint_header_name: e.target.value })} />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-2">
            <Input placeholder="https://xxx.supabase.co" value={form.supabase_url} onChange={(e) => setForm({ ...form, supabase_url: e.target.value })} />
            <Input placeholder="anon key" value={form.supabase_anon_key} onChange={(e) => setForm({ ...form, supabase_anon_key: e.target.value })} />
          </div>
        )}
        <Button onClick={addConn}><Plus className="w-4 h-4 mr-2" />Connecter</Button>
      </Card>

      <div className="grid gap-3">
        <h2 className="font-semibold">Applications connectées</h2>
        {loading && <Loader2 className="w-5 h-5 animate-spin" />}
        {!loading && conns.length === 0 && <p className="text-sm text-muted-foreground">Aucune application connectée.</p>}
        {conns.map((c) => (
          <Card key={c.id} className="p-4 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{c.name}</span>
                <Badge variant="secondary">{c.app_type}</Badge>
                {c.last_sync_status && <Badge variant={c.last_sync_status === "ok" ? "default" : "destructive"}>{c.last_sync_status}</Badge>}
              </div>
              <p className="text-xs text-muted-foreground truncate">{c.connection_mode === "edge_proxy" ? c.endpoint_url : c.supabase_url}</p>
              <p className="text-xs text-muted-foreground">
                {c.schema_cache?.tables?.length ?? 0} tables · {c.last_sync_at ? new Date(c.last_sync_at).toLocaleString() : "jamais scanné"}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={() => scanOne(c.id)} disabled={scanning === c.id}>
              {scanning === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => removeConn(c.id)}><Trash2 className="w-4 h-4" /></Button>
          </Card>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4" />Journal Cyounne (temps réel)</h2>
        <Card className="divide-y">
          {events.length === 0 && <p className="p-4 text-sm text-muted-foreground">Aucun événement.</p>}
          {events.map((ev) => (
            <div key={ev.id} className="p-3 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={ev.severity === "warn" ? "destructive" : "secondary"}>{ev.event_type}</Badge>
                <span className="font-medium">{ev.title}</span>
                <span className="text-xs text-muted-foreground ml-auto">{new Date(ev.created_at).toLocaleString()}</span>
              </div>
              {ev.description && <p className="text-xs text-muted-foreground mt-1">{ev.description}</p>}
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
