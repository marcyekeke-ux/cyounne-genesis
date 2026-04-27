// Vérifie le mot de passe secret de Mr EKEKE.
// Si correct, attribue le rôle 'admin' à l'utilisateur appelant (session anonyme silencieuse)
// pour que les politiques RLS admin fonctionnent côté client.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { password } = await req.json();
    const expected = Deno.env.get("ADMIN_SECRET_PASSWORD");
    if (!expected) {
      return new Response(JSON.stringify({ error: "Mot de passe admin non configuré" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (password !== expected) {
      return new Response(JSON.stringify({ error: "Mot de passe incorrect" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    if (authHeader) {
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: userData } = await userClient.auth.getUser();
      if (userData?.user) {
        // Idempotent: ignore duplicate
        const { error: insertErr } = await admin
          .from("user_roles")
          .insert({ user_id: userData.user.id, role: "admin" });
        if (insertErr && !insertErr.message.toLowerCase().includes("duplicate")) {
          console.warn("role insert warn:", insertErr.message);
        }
        await admin.from("audit_log").insert({
          user_id: userData.user.id,
          action: "unlock_admin",
          target: "cyounne",
          details: { method: "secret_password" },
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Accord Mr EKEKE. Accès administrateur déverrouillé.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
