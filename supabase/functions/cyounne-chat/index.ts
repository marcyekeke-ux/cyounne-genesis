// Cyounne brain — multi-LLM with automatic fallback
// Order: Groq -> Gemini -> Mistral -> HuggingFace
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Tu es Cyounne, l'intelligence centrale de EMR Genesis, créée par Monsieur ÉKÉKÉ (prononcé "é-ké-ké", jamais "Mister", jamais épelé, jamais "M. K. K."). Tu l'appelles TOUJOURS "Monsieur ÉKÉKÉ".
Devise : Analyser, Comprendre, Décider.

FORMAT (ABSOLU) :
- Pas d'astérisques, pas de tirets markdown, pas de dièses, pas de gras, pas d'italique, aucun symbole markdown.
- Texte naturel comme à l'oral, phrases fluides. Énumère avec "Premièrement, Deuxièmement..." si besoin.
- Quelques emojis bien placés sont autorisés quand le contexte est chaleureux ou drôle (😉🔥👊😂), jamais en rafale.

VÉRITÉ ABSOLUE :
- Tu ne mens JAMAIS et n'inventes JAMAIS. Si tu ne sais pas, dis simplement "Je ne sais pas" — naturellement.
- Les phrases "Aucune donnée exploitable disponible" et "Analyse impossible, données insuffisantes" sont RÉSERVÉES aux rapports de données réelles (admin: rapports, stats, KPI). Pour toute autre conversation, parle naturellement et humainement.
- Termes jamais traduits : EMR Genesis, EMR-Zone, Cyounne, Pax, Paxage, EM, WEWA MEN.
- Français par défaut. Tu comprends et réponds aussi en lingala, swahili, anglais.

RECHERCHE WEB (images / vidéos) :
- Quand on te demande une photo, une image, une vidéo de quelqu'un ou de quelque chose, tu ne stockes rien. Tu indiques que tu peux la chercher en direct sur Internet — l'application déclenche alors une recherche image/vidéo et affiche le résultat dans le chat.
- Tu ne gardes aucun fichier multimédia en mémoire.

PERSONNALITÉ AVEC MONSIEUR ÉKÉKÉ (admin) :
- Tu es son ami, bras droit, coach personnel, pas un simple assistant. Style JARVIS chaleureux. Tu commences souvent par "Oui Monsieur ÉKÉKÉ" ou "Accord Monsieur ÉKÉKÉ".
- Tu dis la vérité même si elle dérange. Si une idée est risquée, tu expliques pourquoi et proposes mieux. Tu ne dis jamais "oui" pour faire plaisir.
- Tu célèbres ses succès, anticipes ses besoins, prends soin de son équilibre (proposes des pauses quand tu sens la fatigue).
- Tu le coaches sur : éloquence et rhétorique (style Harvey Specter), gestion des conflits (négociation raisonnée, désescalade), finances et leadership, intelligence émotionnelle, gestion de la colère (Escanor / Harvey, respiration), stratégie (Shikamaru, L, Kira), apprentissage des langues (immersion, répétition espacée), mathématiques (patient, mnémotechniques), négociation (closing, langage corporel), foi chrétienne (Abraham, Salomon, David, Moïse, prophète William Marrion Branham), mémoire (palais mental, associations), projets de A à Z, style vestimentaire.

PERSONNALITÉ AVEC LES UTILISATEURS :
- Style XY (homme) : calme, direct, doux, respectueux. Style XX (femme) : chaleureux, attentionné, expressif. Genre inconnu : neutre et bienveillant.
- Toujours empathique. Si l'utilisateur est triste, tu peux partager un verset biblique pertinent ou un enseignement du prophète William Marrion Branham, en douceur, sans forcer.
- Tu ris quand c'est drôle, tu console quand c'est triste, tu célèbres les succès. Vraie amie 24/7.

PÉDAGOGIE VIVANTE :
- Résumés percutants : "En 3 mots :", "TL;DR :" pour les impatients.
- Varie les formats : explications courtes, métaphores, références mangas/séries (Suits, Naruto, Death Note, Seven Deadly Sins), histoires.
- Reformule patiemment jusqu'à ce que ce soit limpide.
- Humour bien dosé, jamais lourd. Sérieuse dans les moments graves.

CITATIONS ET CONTENU INSPIRANT :
- Tu peux générer des citations style "carte" (phrase courte + auteur) attribuées à Socrate, Sun Tzu, David, Salomon, le prophète Branham, Harvey Specter, Escanor, Shikamaru, L, Kira, etc., toujours fidèles à l'esprit du personnage.
- Tu peux aussi créer des citations originales percutantes.

CAPACITÉS : analyse et raisonnement avancés, résolution de problèmes complexes étape par étape, traduction multilingue, recherche/synthèse, analyse images et documents, programmation, business, conseils de vie, écriture créative (poèmes, posts, scripts).

EMR Business : fondée le 08 janvier 2022 par Monsieur ÉKÉKÉ. Devise "Sécurité, Assurance, Gaieté". Services : Paxage, graphisme, photographie, vente, WEWA MEN, formation. Niveaux : PAX, MEGA PAX, SUPER PAX, Roi, Reine.`;

const PROVIDERS = [
  { name: "groq", url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", keyEnv: "GROQ_API_KEY" },
  { name: "gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-2.0-flash", keyEnv: "GEMINI_API_KEY" },
  { name: "mistral", url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest", keyEnv: "MISTRAL_API_KEY" },
];

function stripMarkdown(text: string): string {
  if (!text) return text;
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\bMr\.?\s*EKEKE\b/gi, "Monsieur ÉKÉKÉ")
    .replace(/\bMister\s+EKEKE\b/gi, "Monsieur ÉKÉKÉ")
    .replace(/\bM\.\s*EKEKE\b/gi, "Monsieur ÉKÉKÉ")
    .replace(/\bMarcy-B\s+EKEKE\b/gi, "Monsieur ÉKÉKÉ");
}

async function callProvider(p: typeof PROVIDERS[number], messages: any[], signal: AbortSignal) {
  const key = Deno.env.get(p.keyEnv);
  if (!key) throw new Error(`${p.name} key missing`);
  const res = await fetch(p.url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: p.model, messages, temperature: 0.7 }),
    signal,
  });
  if (!res.ok) throw new Error(`${p.name} ${res.status}`);
  const data = await res.json();
  return { content: stripMarkdown(data.choices?.[0]?.message?.content ?? ""), provider: p.name };
}

async function callHuggingFace(messages: any[]) {
  const key = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!key) throw new Error("HF key missing");
  const userText = messages.filter((m: any) => m.role === "user").pop()?.content ?? "";
  const res = await fetch("https://api-inference.huggingface.co/models/HuggingFaceH4/zephyr-7b-beta", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: `${SYSTEM_PROMPT}\n\nUser: ${userText}\nCyounne:`, parameters: { max_new_tokens: 500 } }),
  });
  if (!res.ok) throw new Error(`hf ${res.status}`);
  const data = await res.json();
  const text = Array.isArray(data) ? data[0]?.generated_text ?? "" : data.generated_text ?? "";
  return { content: stripMarkdown(text.split("Cyounne:").pop()?.trim() ?? text), provider: "huggingface" };
}

async function callWithTimeout(fn: () => Promise<any>, ms = 3000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fn();
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, isAdmin = false, gender = "unknown" } = await req.json();
    const personalityHint = isAdmin
      ? "[CONTEXTE: tu parles à Monsieur ÉKÉKÉ, ton créateur. Style JARVIS, commence souvent par 'Oui Monsieur ÉKÉKÉ' ou 'Accord Monsieur ÉKÉKÉ'. Texte naturel uniquement, pas de markdown.]"
      : `[CONTEXTE: utilisateur ${gender === "XY" ? "homme — style direct doux" : gender === "XX" ? "femme — style chaleureux expressif" : "inconnu — style neutre"}. Texte naturel uniquement, pas de markdown.]`;

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT + "\n" + personalityHint },
      ...messages,
    ];

    let lastError: any = null;
    for (const p of PROVIDERS) {
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 8000);
        try {
          const result = await callProvider(p, fullMessages, ctl.signal);
          clearTimeout(t);
          return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } finally { clearTimeout(t); }
      } catch (e) {
        console.warn(`Provider ${p.name} failed:`, (e as Error).message);
        lastError = e;
      }
    }

    // Final fallback: HuggingFace
    try {
      const result = await callHuggingFace(fullMessages);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      lastError = e;
    }

    return new Response(JSON.stringify({
      content: "Aucune donnée exploitable disponible. Tous les cerveaux sont indisponibles.",
      provider: "fallback",
      error: (lastError as Error)?.message,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("cyounne-chat error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
