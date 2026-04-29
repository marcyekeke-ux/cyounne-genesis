import { supabase } from "@/integrations/supabase/client";

export const ADMIN_FLAG_KEY = "cy_admin_unlocked";
export const ADMIN_TOKEN_KEY = "cy_admin_token";

export function getAdminToken() {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(ADMIN_FLAG_KEY, "1");
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(ADMIN_FLAG_KEY);
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

export async function invokeCyounneAdmin<T = any>(action: string, payload: Record<string, any> = {}) {
  const token = getAdminToken();
  const { data, error } = await supabase.functions.invoke("cyounne-admin", {
    body: { action, token, ...payload },
  });

  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}