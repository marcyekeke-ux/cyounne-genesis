import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Settings, ShieldCheck, UserPlus, Trash2 } from "lucide-react";
import { invokeCyounneAdmin } from "@/lib/cyounneAdmin";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type Role = "admin" | "team_leader" | "pax";
interface RoleRow { id: string; user_id: string; role: Role; created_at: string }
interface ProfileLite { id: string; display_name: string | null }

export default function AdminSettings() {
  const { isAdmin } = useAuth();
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [newUserId, setNewUserId] = useState("");
  const [newRole, setNewRole] = useState<Role>("pax");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const [{ data: r }, { data: p }] = await Promise.all([
        invokeCyounneAdmin<{ data: RoleRow[] }>("select", {
          table: "user_roles", columns: "id,user_id,role,created_at",
          order: { column: "created_at", ascending: false }, limit: 200,
        }),
        invokeCyounneAdmin<{ data: ProfileLite[] }>("select", {
          table: "profiles", columns: "id,display_name", limit: 500,
        }),
      ]);
      setRoles(r ?? []);
      const map: Record<string, string> = {};
      (p ?? []).forEach((x) => { map[x.id] = x.display_name ?? x.id.slice(0, 8); });
      setProfiles(map);
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur chargement rôles");
    }
  };

  useEffect(() => { if (isAdmin) refresh(); }, [isAdmin]);

  const addRole = async () => {
    if (!newUserId.trim()) return;
    setBusy(true);
    try {
      await invokeCyounneAdmin("insert", {
        table: "user_roles",
        values: { user_id: newUserId.trim(), role: newRole },
      });
      toast.success("Rôle attribué");
      setNewUserId("");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally { setBusy(false); }
  };

  const updateRole = async (id: string, role: Role) => {
    try {
      await invokeCyounneAdmin("update", { table: "user_roles", values: { role }, match: { id } });
      toast.success("Rôle mis à jour");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };

  const removeRole = async (id: string) => {
    if (!confirm("Supprimer ce rôle ?")) return;
    try {
      await invokeCyounneAdmin("delete", { table: "user_roles", match: { id } });
      toast.success("Rôle supprimé");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Erreur"); }
  };

  if (!isAdmin) return <div className="p-6">Accès réservé.</div>;

  return (
    <div className="p-6 md:p-10 space-y-6 max-w-4xl mx-auto">
      <header className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-accent" />
        <h1 className="font-display text-2xl font-bold">Paramètres &amp; Rôles</h1>
      </header>

      <Card className="glass p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-accent" />
          <h2 className="font-semibold">Attribuer un rôle</h2>
        </div>
        <div className="grid md:grid-cols-[1fr_auto_auto] gap-3 items-end">
          <div className="space-y-1">
            <Label className="text-xs">User ID (UUID Supabase Auth)</Label>
            <Input
              value={newUserId}
              onChange={(e) => setNewUserId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Rôle</Label>
            <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin (ÉKÉKÉ)</SelectItem>
                <SelectItem value="team_leader">Team Leader</SelectItem>
                <SelectItem value="pax">PAX</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addRole} disabled={busy} className="bg-gradient-primary">
            <UserPlus className="w-4 h-4 mr-1" /> Ajouter
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          L'UUID se trouve dans la table profiles ou auth.users. Trois niveaux : PAX (basique), Team Leader (gestion limitée), Admin (mode JARVIS complet).
        </p>
      </Card>

      <Card className="glass p-6 space-y-3">
        <h2 className="font-semibold">Rôles actuels ({roles.length})</h2>
        <div className="space-y-2">
          {roles.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/40">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{profiles[r.user_id] ?? r.user_id}</div>
                <div className="text-[10px] font-mono text-muted-foreground truncate">{r.user_id}</div>
              </div>
              <Select value={r.role} onValueChange={(v) => updateRole(r.id, v as Role)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="team_leader">Team Leader</SelectItem>
                  <SelectItem value="pax">PAX</SelectItem>
                </SelectContent>
              </Select>
              <Button size="icon" variant="ghost" onClick={() => removeRole(r.id)} title="Supprimer">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          {roles.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Aucun rôle attribué pour l'instant.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
