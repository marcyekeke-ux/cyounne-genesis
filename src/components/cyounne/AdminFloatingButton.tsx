import { useState } from "react";
import { Shield, Loader2, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { AdminPanel } from "./AdminPanel";

/**
 * Bouton "Admin" flottant toujours visible (haut-droite).
 * - Non-admin : clic ouvre mini dialog mot-de-passe → déverrouille → ouvre panneau.
 * - Admin : clic ouvre directement le panneau latéral Vision Totale.
 */
export function AdminFloatingButton() {
  const { isAdmin, unlockAdmin, lockAdmin } = useAuth();
  const [openPanel, setOpenPanel] = useState(false);
  const [openPwd, setOpenPwd] = useState(false);
  const [pwd, setPwd] = useState("");
  const [busy, setBusy] = useState(false);

  const handleClick = () => {
    if (isAdmin) setOpenPanel(true);
    else setOpenPwd(true);
  };

  const submit = async () => {
    if (!pwd) return;
    setBusy(true);
    try {
      await unlockAdmin(pwd);
      toast.success("Accord Mr EKEKE.");
      setPwd("");
      setOpenPwd(false);
      setOpenPanel(true);
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
        onClick={handleClick}
        aria-label="Admin"
        className={`fixed top-3 right-3 z-40 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold backdrop-blur border transition-all shadow-elegant ${
          isAdmin
            ? "bg-gradient-primary text-primary-foreground border-accent/60"
            : "bg-background/60 text-muted-foreground hover:text-foreground border-border/60 hover:border-accent/40"
        }`}
      >
        <Shield className="w-3.5 h-3.5" />
        {isAdmin ? "Vision Totale" : "Admin"}
      </button>

      {/* Password dialog */}
      <Dialog open={openPwd} onOpenChange={setOpenPwd}>
        <DialogContent className="glass max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-accent" /> Accès Administrateur
            </DialogTitle>
            <DialogDescription>Entrez le mot de passe secret de Monsieur ÉKÉKÉ.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              type="password"
              autoFocus
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Mot de passe secret"
            />
            <Button onClick={submit} disabled={!pwd || busy} className="bg-gradient-primary">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Entrer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin panel drawer */}
      <Sheet open={openPanel} onOpenChange={setOpenPanel}>
        <SheetContent side="right" className="w-full sm:max-w-2xl md:max-w-4xl lg:max-w-5xl p-0 overflow-hidden flex flex-col">
          <SheetHeader className="px-5 py-4 border-b border-border/60 glass flex flex-row items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-accent" />
              <span className="font-display text-lg text-gradient">Vision Totale · Cyounne</span>
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => { lockAdmin(); setOpenPanel(false); toast.success("Mode admin verrouillé"); }}>
                Verrouiller
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setOpenPanel(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-hidden">
            <AdminPanel />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
