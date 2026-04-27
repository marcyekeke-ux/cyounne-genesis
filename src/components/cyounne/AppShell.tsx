import { Link, useLocation } from "react-router-dom";
import { Brain, Shield, Image as ImageIcon, Users, Bell, FileText, KeyRound, BookOpen, MessageSquare, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

const userNav = [
  { to: "/chat", label: "Chat", icon: MessageSquare },
];

const adminNav = [
  { to: "/admin", label: "Vision Totale", icon: Brain },
  { to: "/admin/api-keys", label: "Clés API", icon: KeyRound },
  { to: "/admin/knowledge", label: "Connaissances", icon: BookOpen },
  { to: "/admin/media", label: "Médias", icon: ImageIcon },
  { to: "/admin/members", label: "Membres", icon: Users },
  { to: "/admin/alerts", label: "Alertes", icon: Bell },
  { to: "/admin/reports", label: "Rapports", icon: FileText },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const { isAdmin, profile, signOut } = useAuth();

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
        </nav>
        <div className="p-3 border-t border-border/60">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-8 h-8 rounded-full bg-secondary overflow-hidden">
              {profile?.avatar_url && <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{profile?.display_name ?? "—"}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {isAdmin ? "Admin" : "Pax"}
              </div>
            </div>
            <Button size="icon" variant="ghost" onClick={signOut} title="Déconnexion">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}
