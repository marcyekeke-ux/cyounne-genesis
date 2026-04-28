import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { KeyRound, Save, Loader2, CircleDot, TestTube } from "lucide-react";

// OpenAI retiré volontairement (non utilisé, payant).
const SERVICES = [
  { service: "brevo", label: "Brevo (emails)", placeholder: "xkeys-..." },
  { service: "onesignal", label: "OneSignal (push)", placeholder: "REST API Key OneSignal" },
  { service: "whatsapp_business", label: "WhatsApp Business API", placeholder: "Access token Meta" },
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
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from("api_keys").select("*").order("service");
    setRows(data ?? []);
  };

  useEffect(() => { load(); }, []);

  const getRow = (service: string) =>
    rows.find((r) => r.service === service) ?? { service, api_key: "", enabled: true, extra_config: {} };

  const update = (service: string, patch: any) => {
    setRows((rs) => {
      const exists = rs.some((r) => r.service === service);
      if (exists) return rs.map((r) => r.service === service ? { ...r, ...patch } : r);
      return [...rs, { service, api_key: "", enabled: true, extra_config: {}, ...patch }];
    });
  };

  const save = async (service: string) => {
    setBusyKey(service);
    const row = getRow(service);
    // upsert pour créer si absent
    const { error } = await supabase.from("api_keys").upsert({
      service,
      api_key: row.api_key ?? "",
      enabled: row.enabled ?? true,
      extra_config: row.extra_config ?? {},
      updated_at: new Date().toISOString(),
    }, { onConflict: "service" });
    setBusyKey(null);
    if (error) toast.error(`${service} : ${error.message}`);
    else { toast.success(`${service} sauvegardé`); load(); }
  };

  const test = async (service: string) => {
    setTesting(service);
    const row = getRow(service);
    const ok = !!row.api_key && row.api_key.length > 4;
    setTimeout(() => {
      setTesting(null);
      if (ok) toast.success(`${service} : clé présente`);
      else toast.error(`${service} : clé absente ou invalide`);
    }, 400);
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <header className="flex items-center gap-3">
        <KeyRound className="w-6 h-6 text-accent" />
        <div>
          <h1 className="font-display text-2xl font-black text-gradient">Clés API</h1>
          <p className="text-xs text-muted-foreground">Groq, Gemini, Mistral, HuggingFace, ElevenLabs, Deepgram sont gérées en sécurité par Lovable.</p>
        </div>
      </header>

      <Card className="glass p-4">
        <h3 className="font-bold text-xs mb-2 uppercase tracking-widest text-muted-foreground">🔒 Clés sécurisées (Lovable)</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {SECURED_BY_LOVABLE.map((k) => (
            <div key={k} className="flex items-center gap-2 text-[11px] px-2 py-1.5 rounded-lg bg-secondary/40 border border-border/40">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="font-mono">{k}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="space-y-2">
        {SERVICES.map((s) => {
          const row = getRow(s.service);
          const has = !!row.api_key && row.api_key.length > 4;
          return (
            <Card key={s.service} className="glass p-3 flex flex-col md:flex-row md:items-center gap-2">
              <div className="md:w-44 shrink-0 flex items-center gap-2">
                <CircleDot className={`w-3 h-3 ${has ? "text-success" : "text-destructive"}`} />
                <div>
                  <div className="font-medium text-sm">{s.label}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{s.service}</div>
                </div>
              </div>
              <Input
                type="password"
                placeholder={s.placeholder}
                value={row.api_key ?? ""}
                onChange={(e) => update(s.service, { api_key: e.target.value })}
                className="flex-1"
              />
              <div className="flex items-center gap-1.5">
                <Switch checked={!!row.enabled} onCheckedChange={(v) => update(s.service, { enabled: v })} />
                <Button size="sm" variant="outline" onClick={() => test(s.service)} disabled={testing === s.service}>
                  {testing === s.service ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <TestTube className="w-3.5 h-3.5" />}
                </Button>
                <Button size="sm" onClick={() => save(s.service)} disabled={busyKey === s.service} className="bg-gradient-primary">
                  {busyKey === s.service ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
