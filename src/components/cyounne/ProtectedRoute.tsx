import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/cyounne/AppShell";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading, isAdmin } = useAuth();
  const loc = useLocation();
  // small delay to allow roles to load
  const [rolesReady, setRolesReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setRolesReady(true), 400);
    return () => clearTimeout(t);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace state={{ from: loc }} />;
  if (adminOnly && rolesReady && !isAdmin) return <Navigate to="/admin" replace />;
  return <AppShell>{children}</AppShell>;
}
