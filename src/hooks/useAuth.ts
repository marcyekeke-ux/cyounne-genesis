import { useEffect, useState } from "react";
import { invokeCyounneAdmin, setAdminToken, clearAdminToken, getAdminToken, ADMIN_FLAG_KEY } from "@/lib/cyounneAdmin";

/**
 * Cyounne n'a PAS de système de comptes visible.
 * - Aucune session anonyme : tout l'admin passe par l'edge function `cyounne-admin`
 *   qui utilise le mot de passe secret de Mr ÉKÉKÉ pour émettre un jeton signé.
 * - Le statut admin est dérivé de la présence d'un jeton non expiré en sessionStorage.
 */
export function useAuth() {
  const [isAdmin, setIsAdmin] = useState<boolean>(
    typeof window !== "undefined" && sessionStorage.getItem(ADMIN_FLAG_KEY) === "1" && !!getAdminToken()
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Vérifier que le jeton existe encore et n'a pas expiré
    if (!isAdmin) return;
    const token = getAdminToken();
    if (!token) {
      setIsAdmin(false);
      return;
    }
    invokeCyounneAdmin<{ ok: boolean }>("verify").then((res) => {
      if (!res?.ok) {
        clearAdminToken();
        setIsAdmin(false);
      }
    }).catch(() => {
      clearAdminToken();
      setIsAdmin(false);
    });
  }, []);

  const unlockAdmin = async (password: string) => {
    setLoading(true);
    try {
      const res = await invokeCyounneAdmin<{ token: string }>("unlock", { password });
      if (!res?.token) throw new Error("Échec du déverrouillage");
      setAdminToken(res.token);
      setIsAdmin(true);
      return true;
    } finally {
      setLoading(false);
    }
  };

  const lockAdmin = () => {
    clearAdminToken();
    setIsAdmin(false);
  };

  // Compat avec l'ancien hook
  const signOut = lockAdmin;
  const reload = () => {};
  const user = null;
  const session = null;
  const profile = null;
  const roles: string[] = isAdmin ? ["admin"] : [];

  return { user, session, profile, isAdmin, loading, unlockAdmin, lockAdmin, signOut, reload, roles };
}
