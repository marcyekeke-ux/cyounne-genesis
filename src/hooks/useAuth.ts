import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "admin" | "pax" | "mega_pax" | "super_pax" | "roi" | "reine";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // Defer DB calls to avoid recursion in callback
        setTimeout(() => loadUserData(sess.user.id), 0);
      } else {
        setRoles([]);
        setProfile(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) loadUserData(sess.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserData(userId: string) {
    const [{ data: rolesData }, { data: profileData }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    ]);
    setRoles((rolesData ?? []).map((r: any) => r.role));
    setProfile(profileData);
  }

  const isAdmin = roles.includes("admin");

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, session, roles, profile, isAdmin, loading, signOut, reload: () => user && loadUserData(user.id) };
}
