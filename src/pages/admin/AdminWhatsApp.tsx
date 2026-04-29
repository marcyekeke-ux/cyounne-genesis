import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeCyounneAdmin } from "@/lib/cyounneAdmin";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MessageCircle, Save, Loader2, Copy, ExternalLink, Webhook, ArrowDown, ArrowUp } from "lucide-react";
import { toast } from "sonner";

export default function AdminWhatsApp() {
  const [wa, setWa] = useState<any>({ enabled: true, extra_config: { phone_number_id: "", verify_token: "cyounne_verify", access_token: "" } });
  const [ap, setAp] = useState<any>({ enabled: true, extra_config: { webhook_url: "" } });
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.functions.supabase.co/whatsapp-webhook`;

  const load = async () => {
    try {
      const [w, a, msgs] = await Promise.all([
        invokeCyounneAdmin<{ data: any[] }>("select", { table: "api_keys", filters: { service: "whatsapp_business" } }),
        invokeCyounneAdmin<{ data: any[] }>("select", { table: "api_keys", filters: { service: "activepieces" } }),
        invokeCyounneAdmin<{ data: any[] }>("select", { table: "whatsapp_messages", order: { column: "created_at", ascending: false }, limit: 50 }),
      ]);
      const wRow = w.data?.[0]; const aRow = a.data?.[0];
      if (wRow) setWa({ ...wRow, extra_config: wRow.extra_config ?? {} });
      if (aRow) setAp({ ...aRow, extra_config: aRow.extra_config ?? {} });
      setMessages(msgs.data ?? []);
    } catch (e: any) { toast.error(e?.message); }
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("whatsapp-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_messages" }, (p) => {
        setMessages((m) => [p.new, ...m].slice(0, 50));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const save = async (service: "whatsapp_business" | "activepieces", row: any) => {
    setBusy(true);
    try {
      await invokeCyounneAdmin("upsert", {
        table: "api_keys",
        onConflict: "service",
        values: {
          service,
          api_key: row.api_key ?? "",
          enabled: row.enabled,
          extra_config: row.extra_config ?? {},
          updated_at: new Date().toISOString(),
        },
      });
      toast.success("Sauvegardé");
    } catch (e: any) { toast.error(e?.message); }
    finally { setBusy(false); }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copié");
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-5xl">
      <header className="flex items-center gap-3">
        <MessageCircle className="w-7 h-7 text-accent" />
        <div>
          <h1 className="font-display text-3xl font-black text-gradient">WhatsApp 24/7</h1>
          <p className="text-sm text-muted-foreground">Cyounne répond automatiquement à vos clients via WhatsApp Business API · miroir Activepieces</p>
        </div>
      </header>

      {/* Webhook URL */}
      <Card className="glass p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-accent" />
          <h2 className="font-display font-bold">Webhook Cyounne</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Collez cette URL dans Meta Developers → Configuration WhatsApp → Webhook callback URL.
          Utilisez le verify token configuré ci-dessous.
        </p>
        <div className="flex gap-2">
          <Input readOnly value={webhookUrl} className="font-mono text-xs" />
          <Button variant="outline" size="icon" onClick={() => copy(webhookUrl)}><Copy className="w-4 h-4" /></Button>
          <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">
            <Button variant="outline" size="icon"><ExternalLink className="w-4 h-4" /></Button>
          </a>
        </div>
      </Card>

      {/* WhatsApp Business config */}
      <Card className="glass p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold">WhatsApp Business Cloud API</h2>
          <Switch checked={!!wa.enabled} onCheckedChange={(v) => setWa({ ...wa, enabled: v })} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Phone Number ID</Label>
            <Input value={wa.extra_config?.phone_number_id ?? ""} onChange={(e) => setWa({ ...wa, extra_config: { ...wa.extra_config, phone_number_id: e.target.value } })} placeholder="1234567890" />
          </div>
          <div>
            <Label className="text-xs">Verify Token (libre, à coller dans Meta)</Label>
            <Input value={wa.extra_config?.verify_token ?? ""} onChange={(e) => setWa({ ...wa, extra_config: { ...wa.extra_config, verify_token: e.target.value } })} placeholder="cyounne_verify" />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Permanent Access Token (Meta)</Label>
            <Input type="password" value={wa.extra_config?.access_token ?? ""} onChange={(e) => setWa({ ...wa, extra_config: { ...wa.extra_config, access_token: e.target.value } })} placeholder="EAAG..." />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save("whatsapp_business", wa)} disabled={busy} className="bg-gradient-primary">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Sauvegarder WhatsApp
          </Button>
        </div>
      </Card>

      {/* Activepieces */}
      <Card className="glass p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold">Activepieces (workflow externe)</h2>
          <Switch checked={!!ap.enabled} onCheckedChange={(v) => setAp({ ...ap, enabled: v })} />
        </div>
        <p className="text-xs text-muted-foreground">
          Chaque message WhatsApp reçu et chaque réponse de Cyounne sont envoyés à ce webhook Activepieces (CRM, alertes Telegram, archivage…).
        </p>
        <div>
          <Label className="text-xs">Webhook URL Activepieces</Label>
          <Input value={ap.extra_config?.webhook_url ?? ""} onChange={(e) => setAp({ ...ap, extra_config: { ...ap.extra_config, webhook_url: e.target.value } })} placeholder="https://cloud.activepieces.com/api/v1/webhooks/..." />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => save("activepieces", ap)} disabled={busy} className="bg-gradient-primary">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Sauvegarder Activepieces
          </Button>
        </div>
      </Card>

      {/* Live conversations */}
      <Card className="glass p-5">
        <h2 className="font-display font-bold mb-3">Conversations en direct</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucun message pour le moment. Configurez le webhook dans Meta puis envoyez un test.</p>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {messages.map((m) => (
              <div key={m.id} className={`flex items-start gap-2 text-sm p-2 rounded-lg ${m.direction === "in" ? "bg-secondary/40" : "bg-gradient-primary/10"}`}>
                {m.direction === "in" ? <ArrowDown className="w-4 h-4 mt-0.5 text-accent shrink-0" /> : <ArrowUp className="w-4 h-4 mt-0.5 text-success shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {m.direction === "in" ? `← ${m.from_number}` : `→ ${m.to_number}`} · {new Date(m.created_at).toLocaleString("fr-FR")} · {m.status}
                  </div>
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
