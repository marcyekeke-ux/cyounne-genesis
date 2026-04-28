import { useAuth } from "@/hooks/useAuth";
import { AdminFloatingButton } from "@/components/cyounne/AdminFloatingButton";

/**
 * Shell minimal : plus de sidebar. Le chat occupe toute la surface.
 * L'admin est accessible via le bouton flottant "Admin" en haut à droite, partout.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  useAuth(); // initialise la session anonyme silencieuse
  return (
    <div className="min-h-screen relative">
      <main className="min-h-screen">{children}</main>
      <AdminFloatingButton />
    </div>
  );
}
