import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { KeyRound, Save, Loader2 } from "lucide-react";

const SERVICES = [
  { service: "openai", label: "OpenAI", placeholder: "sk-..." },
  { service: "brevo", label: "Brevo (emails)", placeholder: "xkeys-..." },
  { service: "onesignal", label: "OneSignal (push)", placeholder: "App ID + REST key (JSON)" },
  { service: "whatsapp_business", label: "WhatsApp Business API", placeholder: "Token Cloud API" },
  { service: "cloudinary", label: "Cloudinary", placeholder: "cloud_name:api_key:api_secret" },
  { service: "telegram_bot", label: "Telegram Bot", placeholder: "BotToken" },
  { service: "buffer", label: "Buffer (Facebook/Instagram)", placeholder: "Access token" },
  { service: "activepieces", label: "Activepieces", placeholder: "API key / webhook" },
  { service: "giphy", label: "Giphy", placeholder: "API key" },
  { service: "google_vision", label: "Google Vision", placeholder: "API key (sinon Gemini Vision est utilisé)" },
  { service: "dicebear", label: "DiceBear", placeholder: "(public, optionnel)" },
  { service: "qr_code", label: "QR Code API", placeholder: "(public, optionnel)" },
];

const SECURED_BY_LOVABLE = ["GROQ_API_KEY", "GEMINI_API_KEY", "MISTRAL_API_KEY", "HUGGINGFACE_API_KEY", "ELEVENLABS_API_KEY", "DEEPGRAM_API_KEY"];

export default function AdminApiKeys() {
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("api_keys").select("*").order("service");
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const update = (service: string, patch: any) => {
    setRows((rs) => rs.map((r) => r.service === service ? { ...r, ...patch } : r));
  };

  const save = async (service: string) => {
    setBusy(true);
    const row = rows.find((r) => r.service === service);
    if (!row) return;
    const { error } = await supabase.from("api_keys").update({
      api_key: row.api_key,
      enabled: row.enabled,
      extra_config: row.extra_config ?? {},
      updated_at: new Date().toISOString(),
    }).eq("service", service);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success(`${service} sauvegardé`);
  };

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-5xl">
      <header className="flex items-center gap-3">
        <KeyRound className="w-7 h-7 text-accent" />
        <div>
          <h1 className="font-display text-3xl font-black text-gradient">Clés API</h1>
          <p className="text-sm text-muted-foreground">Gérez ici toutes les intégrations EMR Genesis. Les clés critiques (Groq, Gemini, Mistral, HuggingFace, ElevenLabs, Deepgram) sont stockées de façon sécurisée par Lovable.</p>
        </div>
      </header>

      <Card className="glass p-5">
        <h3 className="font-bold text-sm mb-3">🔒 Clés stockées en sécurité (édition via paramètres Lovable)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {SECURED_BY_LOVABLE.map((k) => (
            <div key={k} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-secondary/40 border border-border/40">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="font-mono">{k}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-3">
        {SERVICES.map((s) => {
          const row = rows.find((r) => r.service === s.service) ?? { service: s.service, api_key: "", enabled: true, extra_config: {} };
          return (
            <Card key={s.service} className="glass p-4 flex flex-col md:flex-row md:items-center gap-3">
              <div className="md:w-48 shrink-0">
                <div className="font-medium text-sm">{s.label}</div>
                <div className="text-[11px] text-muted-foreground font-mono">{s.service}</div>
              </div>
              <Input
                type="password"
                placeholder={s.placeholder}
                value={row.api_key ?? ""}
                onChange={(e) => update(s.service, { api_key: e.target.value })}
                className="flex-1"
              />
              <div className="flex items-center gap-2">
                <Switch checked={!!row.enabled} onCheckedChange={(v) => update(s.service, { enabled: v })} />
                <Button size="sm" onClick={() => save(s.service)} disabled={busy} className="bg-gradient-primary">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
