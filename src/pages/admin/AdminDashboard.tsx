import { useEffect, useState } from "react";
import { invokeCyounneAdmin } from "@/lib/cyounneAdmin";
import { Card } from "@/components/ui/card";
import { Brain, Users, Bell, FileText, Activity, Shield, KeyRound, BookOpen, Lock, LogOut, Globe, Copy, ExternalLink, Settings, MessageCircle, TrendingUp, Code2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function AdminDashboard() {
  const { isAdmin, unlockAdmin, lockAdmin } = useAuth();
  const [stats, setStats] = useState({ members: 0, alerts: 0, reports: 0, conversations: 0, knowledge: 0, media: 0 });
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    invokeCyounneAdmin<{ stats: Record<string, number> }>("stats")
      .then((res) => {
        const s = res.stats ?? {};
        setStats({
          members: s.members ?? 0,
          alerts: s.alerts ?? 0,
          reports: s.reports ?? 0,
          conversations: s.conversations ?? 0,
          knowledge: s.knowledge ?? 0,
          media: s.media_assets ?? 0,
        });
      })
      .catch((e) => toast.error(e?.message ?? "Erreur stats"));
  }, [isAdmin]);

  const unlock = async () => {
    if (!pwd) return;
    setBusy(true);
    try {
      await unlockAdmin(pwd);
      toast.success("Accord Mr EKEKE. Accès admin déverrouillé.");
      setPwd("");
    } catch (e: any) {
      toast.error(e?.message ?? "Mot de passe incorrect");
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-6 md:p-10 max-w-xl mx-auto">
        <Card className="glass p-8">
          <div className="flex items-center gap-3 mb-2">
            <Lock className="w-6 h-6 text-accent" />
            <h1 className="font-display text-2xl font-bold">Accès Administrateur</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Saisissez le mot de passe secret de Mr EKEKE pour accéder au panneau Cyounne.
          </p>
          <div className="flex gap-2">
            <Input
              type="password"
              autoFocus
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              placeholder="Mot de passe secret"
            />
            <Button onClick={unlock} disabled={!pwd || busy} className="bg-gradient-primary">
              Entrer
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-4">
            L'authentification générale s'effectue depuis EMR Genesis. Cyounne ne gère pas de comptes.
          </p>
        </Card>
      </div>
    );
  }

  const cards = [
    { label: "Membres", value: stats.members, icon: Users, to: "/admin/members", color: "from-blue-500 to-cyan-400" },
    { label: "Alertes ouvertes", value: stats.alerts, icon: Bell, to: "/admin/alerts", color: "from-red-500 to-orange-400" },
    { label: "Rapports", value: stats.reports, icon: FileText, to: "/admin/reports", color: "from-violet-500 to-fuchsia-400" },
    { label: "Conversations", value: stats.conversations, icon: Activity, to: "/chat", color: "from-emerald-500 to-teal-400" },
    { label: "Connaissances", value: stats.knowledge, icon: BookOpen, to: "/admin/knowledge", color: "from-amber-500 to-yellow-400" },
    { label: "Médias", value: stats.media, icon: KeyRound, to: "/admin/media", color: "from-indigo-500 to-blue-400" },
    { label: "Clés API", value: 0, icon: Shield, to: "/admin/api-keys", color: "from-pink-500 to-rose-400" },
    { label: "WhatsApp", value: 0, icon: MessageCircle, to: "/admin/whatsapp", color: "from-green-500 to-emerald-400" },
    { label: "Paramètres & Rôles", value: 0, icon: Settings, to: "/admin/settings", color: "from-slate-500 to-zinc-400" },
  ];

  return (
    <div className="p-6 md:p-10 space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Brain className="w-7 h-7 text-accent" />
            <h1 className="font-display text-3xl font-black text-gradient">Vision Totale</h1>
            <Shield className="w-4 h-4 text-accent ml-2" />
          </div>
          <p className="text-sm text-muted-foreground mt-1">État global de EMR Genesis · données réelles uniquement</p>
        </div>
        <Button variant="outline" size="sm" onClick={lockAdmin}>
          <LogOut className="w-4 h-4 mr-1" /> Verrouiller
        </Button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link key={c.label} to={c.to}>
              <Card className="glass p-5 hover:shadow-elegant transition-all hover:-translate-y-0.5 cursor-pointer h-full">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div className="text-3xl font-display font-bold">{c.value}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{c.label}</div>
              </Card>
            </Link>
          );
        })}
      </section>

      <PublicUrlPanel />

      <Card className="glass p-6">
        <h2 className="font-display text-lg font-bold mb-2">Devise</h2>
        <p className="text-sm text-muted-foreground italic">« Analyser · Comprendre · Décider »</p>
        <p className="text-xs text-muted-foreground mt-4">Cyounne — créée par Monsieur ÉKÉKÉ · 08 janvier 2022</p>
      </Card>
    </div>
  );
}

function PublicUrlPanel() {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const previewMatch = origin.match(/^https?:\/\/id-preview--([0-9a-f-]+)\.lovable\.app$/i);
  const publishedUrl = previewMatch ? `https://${previewMatch[1]}.lovable.app` : origin;
  const isPreview = !!previewMatch;
  const copy = (url: string) => { navigator.clipboard.writeText(url); toast.success("URL copiée"); };

  return (
    <Card className="glass p-6 space-y-3">
      <div className="flex items-center gap-2">
        <Globe className="w-5 h-5 text-accent" />
        <h2 className="font-display text-lg font-bold">URL publique de l'application</h2>
      </div>
      <p className="text-xs text-muted-foreground">Voici les liens d'accès à Cyounne. Partagez l'URL publiée à vos utilisateurs.</p>
      <div className="space-y-2">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/40 border border-border/50">
          <span className="text-[10px] uppercase tracking-widest text-accent shrink-0">Publiée</span>
          <code className="flex-1 text-xs font-mono truncate">{publishedUrl}</code>
          <Button size="icon" variant="ghost" onClick={() => copy(publishedUrl)} title="Copier"><Copy className="w-4 h-4" /></Button>
          <a href={publishedUrl} target="_blank" rel="noreferrer"><Button size="icon" variant="ghost" title="Ouvrir"><ExternalLink className="w-4 h-4" /></Button></a>
        </div>
        {isPreview && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/20 border border-border/40">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground shrink-0">Preview</span>
            <code className="flex-1 text-xs font-mono truncate">{origin}</code>
            <Button size="icon" variant="ghost" onClick={() => copy(origin)} title="Copier"><Copy className="w-4 h-4" /></Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          {isPreview
            ? "L'URL publiée devient active dès que vous cliquez sur Publier dans l'éditeur."
            : "Cette URL est l'adresse actuelle de Cyounne en production."}
        </p>
      </div>
    </Card>
  );
}
