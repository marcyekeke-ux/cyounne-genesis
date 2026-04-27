import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

const ADMIN_FLAG_KEY = "cy_admin_unlocked";

/**
 * Cyounne n'a PAS de système de comptes visible.
 * - Une session anonyme est créée silencieusement pour chaque visiteur (invisible).
 * - L'accès admin se débloque uniquement via le mot de passe secret de Mr EKEKE
 *   (vérifié par l'edge function `bootstrap-admin`, puis flag stocké en sessionStorage).
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean>(
    typeof window !== "undefined" && sessionStorage.getItem(ADMIN_FLAG_KEY) === "1"
  );

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        setTimeout(() => loadProfile(sess.user.id), 0);
      } else {
        setProfile(null);
      }
    });

    (async () => {
      const { data: { session: sess } } = await supabase.auth.getSession();
      if (sess?.user) {
        setSession(sess);
        setUser(sess.user);
        loadProfile(sess.user.id);
        setLoading(false);
      } else {
        // Sign in anonymously (silent) so we have a user_id for DB writes.
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.warn("Anon sign-in failed (Cyounne reste utilisable hors-ligne):", error.message);
        } else if (data.session) {
          setSession(data.session);
          setUser(data.user ?? null);
          if (data.user) loadProfile(data.user.id);
        }
        setLoading(false);
      }
    })();

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    setProfile(data);
  }

  const unlockAdmin = async (password: string) => {
    const { data, error } = await supabase.functions.invoke("bootstrap-admin", { body: { password } });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    sessionStorage.setItem(ADMIN_FLAG_KEY, "1");
    setIsAdmin(true);
    return true;
  };

  const lockAdmin = () => {
    sessionStorage.removeItem(ADMIN_FLAG_KEY);
    setIsAdmin(false);
  };

  // Compat
  const signOut = lockAdmin;
  const reload = () => user && loadProfile(user.id);
  const roles: string[] = isAdmin ? ["admin"] : [];

  return { user, session, profile, isAdmin, loading, unlockAdmin, lockAdmin, signOut, reload, roles };
}
