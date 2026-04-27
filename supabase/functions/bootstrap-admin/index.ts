// Promote a user to admin using the secret password ADMIN_SECRET_PASSWORD.
// Used once by Mr EKEKE after first signup.
import { corsHeaders } from "@supabase/supabase-js/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { password } = await req.json();
    const expected = Deno.env.get("ADMIN_SECRET_PASSWORD");
    if (!expected) return new Response(JSON.stringify({ error: "Admin password not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (password !== expected) return new Response(JSON.stringify({ error: "Mot de passe incorrect" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Get caller from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Non authentifié" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return new Response(JSON.stringify({ error: "Utilisateur introuvable" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supabaseUrl, serviceKey);
    const { error: insertErr } = await admin.from("user_roles").insert({ user_id: userData.user.id, role: "admin" });
    if (insertErr && !insertErr.message.includes("duplicate")) {
      return new Response(JSON.stringify({ error: insertErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await admin.from("audit_log").insert({
      user_id: userData.user.id,
      action: "promote_admin",
      target: userData.user.email,
      details: { method: "bootstrap" },
    });

    return new Response(JSON.stringify({ success: true, message: "Accord Mr EKEKE. Vous êtes maintenant administrateur." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
