import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Settings, ShieldCheck, Search, Crown, Users, User } from "lucide-react";
import { invokeCyounneAdmin } from "@/lib/cyounneAdmin";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Role = "admin" | "team_leader" | "pax";

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}
interface RoleRow {
  id: string;
  user_id: string;
  role: Role;
}

const ROLE_META: Record<Role, { label: string; icon: any; color: string }> = {
  admin: { label: "Admin", icon: Crown, color: "bg-gradient-primary text-primary-foreground" },
  team_leader: { label: "Team Leader", icon: Users, color: "bg-accent/20 text-accent" },
  pax: { label: "PAX", icon: User, color: "bg-secondary text-secondary-foreground" },
};

export default function AdminSettings() {
  const { isAdmin } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rolesByUser, setRolesByUser] = useState<Record<string, { id: string; role: Role }>>({});
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [{ data: p }, { data: r }] = await Promise.all([
        invokeCyounneAdmin<{ data: Profile[] }>("select", {
          table: "profiles",
          columns: "id,display_name,avatar_url",
          order: { column: "created_at", ascending: false },
          limit: 1000,
        }),
        invokeCyounneAdmin<{ data: RoleRow[] }>("select", {
          table: "user_roles",
          columns: "id,user_id,role",
          limit: 2000,
        }),
      ]);
      setProfiles(p ?? []);
      const map: Record<string, { id: string; role: Role }> = {};
      (r ?? []).forEach((row) => {
        // garde le rôle le plus élevé si plusieurs
        const current = map[row.user_id];
        const rank: Record<Role, number> = { pax: 1, team_leader: 2, admin: 3 };
        if (!current || rank[row.role] > rank[current.role]) {
          map[row.user_id] = { id: row.id, role: row.role };
        }
      });
      setRolesByUser(map);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur chargement");
    }
  };

  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  const changeRole = async (userId: string, newRole: Role) => {
    setBusy(userId);
    try {
      const existing = rolesByUser[userId];
      if (existing) {
        await invokeCyounneAdmin("update", {
          table: "user_roles",
          values: { role: newRole },
          match: { id: existing.id },
        });
      } else {
        await invokeCyounneAdmin("insert", {
          table: "user_roles",
          values: { user_id: userId, role: newRole },
        });
      }
      toast.success(`Rôle mis à jour : ${ROLE_META[newRole].label}`);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) =>
      (p.display_name ?? "").toLowerCase().includes(q)
    );
  }, [profiles, query]);

  const counts = useMemo(() => {
    const c = { admin: 0, team_leader: 0, pax: 0, total: profiles.length };
    Object.values(rolesByUser).forEach((r) => { c[r.role]++; });
    return c;
  }, [rolesByUser, profiles]);

  if (!isAdmin) return <div className="p-6">Accès réservé.</div>;

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-5xl mx-auto">
      <header className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-accent" />
        <div>
          <h1 className="font-display text-2xl font-bold">Paramètres et rôles</h1>
          <p className="text-sm text-muted-foreground">
            Cyounne reconnaît automatiquement tout le monde. Cliquez sur un utilisateur pour changer son rôle.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass p-4">
          <div className="text-xs text-muted-foreground">Total inscrits</div>
          <div className="text-2xl font-bold">{counts.total}</div>
        </Card>
        <Card className="glass p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Crown className="w-3 h-3" /> Admins</div>
          <div className="text-2xl font-bold">{counts.admin}</div>
        </Card>
        <Card className="glass p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Team Leaders</div>
          <div className="text-2xl font-bold">{counts.team_leader}</div>
        </Card>
        <Card className="glass p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><User className="w-3 h-3" /> PAX</div>
          <div className="text-2xl font-bold">{counts.pax}</div>
        </Card>
      </div>

      <Card className="glass p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-accent" />
          <p className="text-xs text-muted-foreground">
            Chaque nouvel inscrit reçoit le rôle PAX automatiquement. Promouvez-le ici en un clic.
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un membre par nom..."
            className="pl-9"
          />
        </div>
      </Card>

      <Card className="glass p-2 md:p-4">
        <div className="space-y-2">
          {filtered.map((p) => {
            const current = rolesByUser[p.id]?.role ?? "pax";
            const Meta = ROLE_META[current];
            const Icon = Meta.icon;
            return (
              <div
                key={p.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/40 hover:bg-secondary/50 transition-colors"
              >
                <Avatar className="w-10 h-10 shrink-0">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback>
                    {(p.display_name ?? "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {p.display_name ?? "Sans nom"}
                  </div>
                  <Badge variant="secondary" className={`text-[10px] mt-1 ${Meta.color}`}>
                    <Icon className="w-3 h-3 mr-1" /> {Meta.label}
                  </Badge>
                </div>
                <Select
                  value={current}
                  onValueChange={(v) => changeRole(p.id, v as Role)}
                  disabled={busy === p.id}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pax">PAX</SelectItem>
                    <SelectItem value="team_leader">Team Leader</SelectItem>
                    <SelectItem value="admin">Admin (ÉKÉKÉ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground italic text-center py-8">
              Aucun membre trouvé.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}
