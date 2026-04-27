import { useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

/**
 * Bouton "Admin" discret, flottant en bas à droite.
 * - Caché si déjà admin.
 * - Ouvre une mini-boîte mot-de-passe → débloque + redirige vers /admin.
 */
export function AdminQuickUnlock() {
  const { isAdmin, unlockAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  if (isAdmin) return null;

  const submit = async () => {
    if (!pwd) return;
    setBusy(true);
    try {
      await unlockAdmin(pwd);
      toast.success("Accord Mr EKEKE.");
      setPwd("");
      setOpen(false);
      navigate("/admin");
    } catch (e: any) {
      toast.error(e?.message ?? "Mot de passe incorrect");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="Admin"
        onClick={() => setOpen(true)}
        className="fixed bottom-3 right-3 z-40 flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-medium text-muted-foreground/70 hover:text-foreground bg-background/40 hover:bg-background/80 backdrop-blur border border-border/40 transition-all"
      >
        <Shield className="w-3 h-3" />
        Admin
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" /> Accès administrateur
            </DialogTitle>
            <DialogDescription>
              Entrez le mot de passe secret de Mr EKEKE.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              type="password"
              autoFocus
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Mot de passe"
            />
            <Button onClick={submit} disabled={!pwd || busy} className="bg-gradient-primary">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
