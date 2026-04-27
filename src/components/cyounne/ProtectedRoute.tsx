import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/cyounne/AppShell";
import { Loader2 } from "lucide-react";

/**
 * Cyounne est libre d'accès. Aucun compte requis.
 * - adminOnly=true : accès uniquement si le mot de passe secret a été entré
 *   (page /admin sert de gate).
 */
export function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { loading, isAdmin } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/admin" replace state={{ from: loc }} />;
  }

  return <AppShell>{children}</AppShell>;
}
