import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/cyounne/AppShell";
import { Loader2 } from "lucide-react";

/**
 * Cyounne est libre d'accès (mode invité par défaut).
 * Seules les routes /admin/* nécessitent un compte ET le rôle admin.
 */
export function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  const loc = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (adminOnly) {
    if (!user) return <Navigate to="/auth" replace state={{ from: loc }} />;
    if (!isAdmin) return <Navigate to="/admin" replace />;
  }

  return <AppShell>{children}</AppShell>;
}
