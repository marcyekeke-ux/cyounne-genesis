import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CyounneAvatar } from "@/components/cyounne/CyounneAvatar";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function Auth() {
  const nav = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<"XY" | "XX" | "unknown">("unknown");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) nav("/chat", { replace: true });
  }, [user, loading, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/chat`,
            data: { display_name: displayName || email.split("@")[0] },
          },
        });
        if (error) throw error;
        if (data.user) {
          // update gender on profile (best effort, after trigger)
          setTimeout(async () => {
            await supabase.from("profiles").update({ gender, display_name: displayName || email.split("@")[0] }).eq("id", data.user!.id);
          }, 600);
        }
        toast.success("Bienvenue. Vérifiez votre email si requis.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Connexion réussie.");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Hero gauche */}
      <div className="hidden lg:flex flex-col items-center justify-center p-10 relative overflow-hidden border-r border-border/60">
        <div className="absolute inset-0 bg-gradient-deep opacity-90" />
        <div className="relative text-center space-y-8">
          <CyounneAvatar state="idle" size={280} />
          <div>
            <h1 className="font-display text-5xl font-black text-gradient">CYOUNNE</h1>
            <p className="mt-3 text-muted-foreground tracking-widest text-xs uppercase">Analyser · Comprendre · Décider</p>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground/90 leading-relaxed">
            L'intelligence centrale de <span className="text-foreground font-medium">EMR Genesis</span>, créée par Marcy-B EKEKE.
          </p>
        </div>
      </div>

      {/* Form droite */}
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 glass shadow-card-cy">
          <div className="lg:hidden flex justify-center mb-6">
            <CyounneAvatar state="idle" size={140} />
          </div>
          <h2 className="font-display text-2xl font-bold mb-1">
            {mode === "signin" ? "Connexion" : "Nouveau compte"}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin" ? "Accédez à Cyounne." : "Rejoignez la plateforme EMR Genesis."}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <Label htmlFor="name">Nom d'affichage</Label>
                  <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Marcy-B EKEKE" />
                </div>
                <div>
                  <Label>Genre (pour le style de réponse)</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1.5">
                    {(["XY", "XX", "unknown"] as const).map((g) => (
                      <button
                        type="button"
                        key={g}
                        onClick={() => setGender(g)}
                        className={`px-3 py-2 rounded-lg text-sm border transition-colors ${gender === g ? "bg-gradient-primary text-primary-foreground border-transparent" : "border-border hover:bg-secondary/60"}`}
                      >
                        {g === "XY" ? "Homme" : g === "XX" ? "Femme" : "Neutre"}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>

            <Button type="submit" disabled={busy} className="w-full bg-gradient-primary hover:opacity-90 text-primary-foreground font-medium">
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {mode === "signin" ? "Se connecter" : "Créer le compte"}
            </Button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-6 text-xs text-muted-foreground hover:text-foreground w-full text-center"
          >
            {mode === "signin" ? "Pas encore de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
          </button>
        </Card>
      </div>
    </div>
  );
}
