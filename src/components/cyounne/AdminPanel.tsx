import { useState } from "react";
import {
  Brain, KeyRound, BookOpen, Image as ImageIcon, Users, Bell, MessageCircle,
  FileText, Settings, TrendingUp, RefreshCw, Coins, AlertTriangle, ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import AdminDashboardView from "@/pages/admin/AdminDashboard";
import AdminApiKeys from "@/pages/admin/AdminApiKeys";
import AdminKnowledge from "@/pages/admin/AdminKnowledge";
import AdminMedia from "@/pages/admin/AdminMedia";
import AdminMembers from "@/pages/admin/AdminMembers";
import AdminAlerts from "@/pages/admin/AdminAlerts";
import AdminWhatsApp from "@/pages/admin/AdminWhatsApp";
import AdminReports from "@/pages/admin/AdminReports";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminTrends from "@/pages/admin/AdminTrends";
import AdminSyncApps from "@/pages/admin/AdminSyncApps";
import AdminTontineRules from "@/pages/admin/AdminTontineRules";
import AdminTontineLate from "@/pages/admin/AdminTontineLate";

type Section = {
  id: string;
  label: string;
  icon: any;
  Component: React.ComponentType;
  group: "Pilotage" | "EMR Tontines" | "Communication" | "Contenu" | "Système";
};

const SECTIONS: Section[] = [
  { id: "dashboard",     label: "Vision Totale",      icon: Brain,         group: "Pilotage",      Component: AdminDashboardView },
  { id: "trends",        label: "Tendances",          icon: TrendingUp,    group: "Pilotage",      Component: AdminTrends },
  { id: "reports",       label: "Rapports",           icon: FileText,      group: "Pilotage",      Component: AdminReports },

  { id: "tontine-rules", label: "Règles tontines",    icon: Coins,         group: "EMR Tontines",  Component: AdminTontineRules },
  { id: "tontine-late",  label: "Retards & relances", icon: AlertTriangle, group: "EMR Tontines",  Component: AdminTontineLate },

  { id: "whatsapp",      label: "WhatsApp",           icon: MessageCircle, group: "Communication", Component: AdminWhatsApp },
  { id: "alerts",        label: "Alertes",            icon: Bell,          group: "Communication", Component: AdminAlerts },
  { id: "members",       label: "Membres",            icon: Users,         group: "Communication", Component: AdminMembers },

  { id: "knowledge",     label: "Connaissances",      icon: BookOpen,      group: "Contenu",       Component: AdminKnowledge },
  { id: "media",         label: "Médias",             icon: ImageIcon,     group: "Contenu",       Component: AdminMedia },

  { id: "api",           label: "Clés API",           icon: KeyRound,      group: "Système",       Component: AdminApiKeys },
  { id: "sync",          label: "Sync apps",          icon: RefreshCw,     group: "Système",       Component: AdminSyncApps },
  { id: "settings",      label: "Paramètres & rôles", icon: Settings,      group: "Système",       Component: AdminSettings },
];

const GROUPS: Section["group"][] = ["Pilotage", "EMR Tontines", "Communication", "Contenu", "Système"];

export function AdminPanel() {
  const [activeId, setActiveId] = useState<string>("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(true);
  const active = SECTIONS.find((s) => s.id === activeId) ?? SECTIONS[0];
  const ActiveComponent = active.Component;

  const Nav = (
    <nav className="p-3 space-y-4">
      {GROUPS.map((g) => (
        <div key={g}>
          <div className="px-2 mb-1.5 text-[10px] uppercase tracking-widest text-muted-foreground/70 font-semibold">
            {g}
          </div>
          <ul className="space-y-0.5">
            {SECTIONS.filter((s) => s.group === g).map((s) => {
              const Icon = s.icon;
              const isActive = s.id === activeId;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => { setActiveId(s.id); setMobileMenuOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs text-left transition-all",
                      isActive
                        ? "bg-gradient-primary text-primary-foreground shadow-elegant"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="h-full flex bg-background">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col w-56 border-r border-border/60 overflow-y-auto bg-secondary/20">
        {Nav}
      </aside>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <aside className="md:hidden absolute inset-0 z-20 bg-background overflow-y-auto">
          {Nav}
        </aside>
      )}

      {/* Content */}
      <section className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden flex items-center gap-2 px-3 py-2 border-b border-border/60 glass">
          <button
            onClick={() => setMobileMenuOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="w-3.5 h-3.5" /> Menu
          </button>
          <div className="ml-auto flex items-center gap-1.5 text-xs font-semibold">
            <active.icon className="w-3.5 h-3.5 text-accent" />
            {active.label}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto">
          <ActiveComponent />
        </div>
      </section>
    </div>
  );
}
