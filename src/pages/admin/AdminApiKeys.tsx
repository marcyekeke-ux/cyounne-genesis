import { useEffect, useState } from "react";
import { invokeCyounneAdmin } from "@/lib/cyounneAdmin";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { KeyRound, Save, Loader2, CircleDot, TestTube, Upload } from "lucide-react";

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
];

const SECURED_BY_LOVABLE = [
  "GROQ_API_KEY", "GEMINI_API_KEY", "MISTRAL_API_KEY", "HUGGINGFACE_API_KEY",
  "ELEVENLABS_API_KEY", "DEEPGRAM_API_KEY", "BREVO_API_KEY",
  "ONESIGNAL_APP_ID", "ONESIGNAL_API_KEY", "WHATSAPP_TOKEN",
  "CLOUDINARY_API_KEY", "TELEGRAM_BOT_TOKEN",
  "ELEVENLABS_VOICE_XY_NICOLAS_ID", "ELEVENLABS_VOICE_XX_JADE_ID",
];

const IMPORT_TEMPLATE = `GROQ : 
GEMINI : 
MISTRAL : 
HUGGINGFACE : 
ELEVENLABS : 
ELEVENLABS_VOICE_XY : 
ELEVENLABS_VOICE_XX : 
DEEPGRAM : 
BREVO : 
ONESIGNAL_APP_ID : 
ONESIGNAL_API_KEY : 
WHATSAPP_TOKEN : 
WHATSAPP_PHONE_NUMBER_ID : 
WHATSAPP_BUSINESS_ID : 
CLOUDINARY : 
TELEGRAM_BOT_TOKEN : `;

function parseImport(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  text.split(/\n+/).forEach((line) => {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]+)\s*[:=]\s*(.+)\s*$/);
    if (!m) return;
    const value = m[2].trim();
    if (!value || /^\[.*\]$/.test(value)) return; // ignore [ta cle]
    out[m[1].toUpperCase()] = value;
  });
  return out;
}

export default function AdminApiKeys() {
  const [rows, setRows] = useState<any[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [importText, setImportText] = useState(IMPORT_TEMPLATE);
  const [importing, setImporting] = useState(false);
  const [keyStatus, setKeyStatus] = useState<Record<string, { hasSecret: boolean; hasDb: boolean }>>({});

  const load = async () => {
    try {
      const res = await invokeCyounneAdmin<{ data: any[] }>("select", { table: "api_keys", order: { column: "service" } });
      setRows(res.data ?? []);
      const st = await invokeCyounneAdmin<{ keys: any }>("key_status");
      setKeyStatus(st.keys ?? {});
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur de chargement");
    }
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
    try {
      await invokeCyounneAdmin("upsert", {
        table: "api_keys",
        onConflict: "service",
        values: {
          service,
          api_key: row.api_key ?? "",
          enabled: row.enabled ?? true,
          extra_config: row.extra_config ?? {},
          updated_at: new Date().toISOString(),
        },
      });
      toast.success(`${service} sauvegardé`);
      load();
    } catch (e: any) {
      toast.error(`${service} : ${e?.message ?? "erreur"}`);
    } finally {
      setBusyKey(null);
    }
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

  const runImport = async () => {
    const entries = parseImport(importText);
    if (!Object.keys(entries).length) {
      toast.error("Aucune clé valide détectée. Remplacez les [ta cle] par les vraies valeurs.");
      return;
    }
    setImporting(true);
    try {
      const res = await invokeCyounneAdmin<{ added: string[]; skipped: string[]; errors: any[] }>("import_keys", { entries });
      const msg = `Ajoutées : ${res.added.length} · Ignorées : ${res.skipped.length}${res.errors.length ? ` · Erreurs : ${res.errors.length}` : ""}`;
      if (res.errors.length) toast.error(msg);
      else toast.success(msg);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Import impossible");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl">
      <header className="flex items-center gap-3">
        <KeyRound className="w-6 h-6 text-accent" />
        <div>
          <h1 className="font-display text-2xl font-black text-gradient">Clés API</h1>
          <p className="text-xs text-muted-foreground">Collez vos clés ci-dessous : celles déjà configurées sont ignorées, les manquantes sont ajoutées automatiquement.</p>
        </div>
      </header>

      <Card className="glass p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-accent" />
          <h3 className="font-bold text-sm">Import groupé</h3>
        </div>
        <Textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          rows={10}
          className="font-mono text-xs"
        />
        <div className="flex justify-end">
          <Button onClick={runImport} disabled={importing} className="bg-gradient-primary">
            {importing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            Importer maintenant
          </Button>
        </div>
      </Card>

      <Card className="glass p-4">
        <h3 className="font-bold text-xs mb-2 uppercase tracking-widest text-muted-foreground">État des clés</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[11px]">
          {Object.entries(keyStatus).map(([k, v]) => {
            const ok = v.hasSecret || v.hasDb;
            return (
              <div key={k} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/40 border border-border/40">
                <span className={`w-2 h-2 rounded-full ${ok ? "bg-success" : "bg-destructive"}`} />
                <span className="font-mono flex-1">{k}</span>
                <span className="text-muted-foreground">
                  {v.hasSecret ? "secret" : v.hasDb ? "db" : "manquante"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="glass p-4">
        <h3 className="font-bold text-xs mb-2 uppercase tracking-widest text-muted-foreground">Clés sécurisées (Lovable)</h3>
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
