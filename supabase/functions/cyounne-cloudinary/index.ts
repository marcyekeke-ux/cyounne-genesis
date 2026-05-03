// Cloudinary signed upload — Cyounne
// Generates a server-side signature so the browser can upload directly to Cloudinary
// without exposing the API secret.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha1Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const cloud = Deno.env.get("CLOUDINARY_CLOUD_NAME");
    const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
    const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");
    if (!cloud || !apiKey || !apiSecret) {
      return new Response(JSON.stringify({ error: "Cloudinary non configuré" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { folder = "cyounne", public_id } = await req.json().catch(() => ({}));
    const timestamp = Math.floor(Date.now() / 1000);
    // Sort params alphabetically: folder, public_id?, timestamp
    const parts: string[] = [];
    parts.push(`folder=${folder}`);
    if (public_id) parts.push(`public_id=${public_id}`);
    parts.push(`timestamp=${timestamp}`);
    const toSign = parts.join("&");
    const signature = await sha1Hex(toSign + apiSecret);

    return new Response(
      JSON.stringify({
        cloud_name: cloud,
        api_key: apiKey,
        timestamp,
        folder,
        public_id: public_id ?? null,
        signature,
        upload_url: `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
