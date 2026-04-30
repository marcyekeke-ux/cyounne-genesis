// Cyounne web search — images, vidéos, infos en temps réel (sans stockage)
// Fournit des URLs publiques d'images (Unsplash / Pexels / DuckDuckGo) et de vidéos (YouTube).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function searchImageUnsplash(query: string) {
  const key = Deno.env.get("UNSPLASH_ACCESS_KEY");
  if (!key) return null;
  const r = await fetch(`https://api.unsplash.com/search/photos?per_page=3&query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `Client-ID ${key}` },
  });
  if (!r.ok) return null;
  const d = await r.json();
  return (d.results ?? []).map((x: any) => ({ url: x.urls?.regular, thumb: x.urls?.small, credit: x.user?.name, source: "unsplash" }));
}

async function searchImagePexels(query: string) {
  const key = Deno.env.get("PEXELS_API_KEY");
  if (!key) return null;
  const r = await fetch(`https://api.pexels.com/v1/search?per_page=3&query=${encodeURIComponent(query)}`, {
    headers: { Authorization: key },
  });
  if (!r.ok) return null;
  const d = await r.json();
  return (d.photos ?? []).map((x: any) => ({ url: x.src?.large, thumb: x.src?.medium, credit: x.photographer, source: "pexels" }));
}

async function searchImageDuckDuckGo(query: string) {
  // Public endpoint — pas de clé requise
  try {
    const tokenRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(query)}`);
    const html = await tokenRes.text();
    const m = html.match(/vqd=['"]([\d-]+)['"]/);
    if (!m) return [];
    const vqd = m[1];
    const r = await fetch(`https://duckduckgo.com/i.js?l=fr-fr&o=json&q=${encodeURIComponent(query)}&vqd=${vqd}&p=1`, {
      headers: { Referer: "https://duckduckgo.com/", "User-Agent": "Mozilla/5.0" },
    });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.results ?? []).slice(0, 3).map((x: any) => ({ url: x.image, thumb: x.thumbnail, credit: x.source, source: "duckduckgo" }));
  } catch { return []; }
}

async function searchVideoYouTube(query: string) {
  // Scrape simple de la page de résultats — pas de clé requise
  try {
    const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "fr-FR" },
    });
    const html = await r.text();
    const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
    if (!m) return [];
    const data = JSON.parse(m[1]);
    const items = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents ?? [];
    return items
      .filter((x: any) => x.videoRenderer)
      .slice(0, 3)
      .map((x: any) => {
        const v = x.videoRenderer;
        return {
          videoId: v.videoId,
          title: v.title?.runs?.[0]?.text,
          thumb: v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url,
          channel: v.ownerText?.runs?.[0]?.text,
          url: `https://www.youtube.com/watch?v=${v.videoId}`,
          embed: `https://www.youtube.com/embed/${v.videoId}`,
          source: "youtube",
        };
      });
  } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { kind = "image", query = "" } = await req.json();
    if (!query.trim()) {
      return new Response(JSON.stringify({ error: "query required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (kind === "video") {
      const videos = await searchVideoYouTube(query);
      return new Response(JSON.stringify({ kind: "video", results: videos }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // image
    let results: any[] | null = null;
    results = await searchImageUnsplash(query);
    if (!results || results.length === 0) results = await searchImagePexels(query);
    if (!results || results.length === 0) results = await searchImageDuckDuckGo(query);

    return new Response(JSON.stringify({ kind: "image", results: results ?? [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cyounne-search error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message, results: [] }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
