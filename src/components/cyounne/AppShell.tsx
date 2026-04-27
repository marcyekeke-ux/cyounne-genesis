import { Link, useLocation } from "react-router-dom";
import { Brain, Shield, Image as ImageIcon, Users, Bell, FileText, KeyRound, BookOpen, MessageSquare, Lock, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { AdminQuickUnlock } from "@/components/cyounne/AdminQuickUnlock";

const userNav = [
  { to: "/chat", label: "Chat", icon: MessageSquare },
];

const adminNav = [
  { to: "/admin", label: "Vision Totale", icon: Brain },
  { to: "/admin/api-keys", label: "Clés API", icon: KeyRound },
  { to: "/admin/knowledge", label: "Connaissances", icon: BookOpen },
  { to: "/admin/media", label: "Médias", icon: ImageIcon },
  { to: "/admin/members", label: "Membres", icon: Users },
  { to: "/admin/alerts", label: "Alertes & Push", icon: Bell },
  { to: "/admin/whatsapp", label: "WhatsApp 24/7", icon: MessageCircle },
  { to: "/admin/reports", label: "Rapports", icon: FileText },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const { isAdmin, lockAdmin } = useAuth();

  const items = [...userNav, ...(isAdmin ? adminNav : [])];

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border/60 glass">
        <div className="p-5 border-b border-border/60">
          <Link to="/chat" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-aurora flex items-center justify-center font-display font-bold text-lg shadow-elegant">
              C
            </div>
            <div>
              <div className="font-display font-bold text-lg leading-none text-gradient">Cyounne</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">EMR Genesis</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {items.map((it) => {
            const Icon = it.icon;
            const active = loc.pathname === it.to || (it.to !== "/chat" && loc.pathname.startsWith(it.to));
            return (
              <Link
                key={it.to}
                to={it.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                  active
                    ? "bg-gradient-primary text-primary-foreground shadow-elegant"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{it.label}</span>
                {it.to.startsWith("/admin") && active && <Shield className="w-3 h-3 ml-auto opacity-80" />}
              </Link>
            );
          })}
          {!isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs text-muted-foreground/60 hover:text-foreground hover:bg-secondary/60"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Mode admin</span>
            </Link>
          )}
        </nav>
        <div className="p-3 border-t border-border/60">
          {isAdmin ? (
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-aurora flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">Mr EKEKE</div>
                <div className="text-[10px] uppercase tracking-wider text-accent">Admin déverrouillé</div>
              </div>
              <Button size="icon" variant="ghost" onClick={lockAdmin} title="Verrouiller">
                <Lock className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <div className="px-2 py-2">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Mode public</div>
              <div className="text-xs text-muted-foreground mt-1">Auth gérée par EMR Genesis</div>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
