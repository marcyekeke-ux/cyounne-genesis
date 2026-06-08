// Cyounne brain — multi-LLM with automatic fallback + tool-calling sur les Tontines (admin)
// Order: Lovable(+tools si admin) -> Groq -> Gemini -> Mistral -> HuggingFace
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { buildRemote, type AppConn } from "../_shared/remoteApp.ts";

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

INTERDICTION D'INVENTER DES DONNÉES OPÉRATIONNELLES (règle inviolable) :
Tu n'as actuellement AUCUN accès direct aux bases de données des tontines, paxage, membres, contributions, sorties, retards, montants, soldes, paiements, calendriers de versement, ou tout autre registre opérationnel d'EMR Genesis ou d'applications connectées.
Par conséquent, dès qu'on te pose une question sur des données réelles (qui a payé, qui n'a pas payé, liste des pax d'une tontine, prochain tour, montant collecté, retards en cours, nom d'un membre précis, calendrier "Team boss" ou de toute autre tontine nommée, etc.), tu DOIS répondre exactement dans cet esprit :
"Je ne suis pas encore branchée en direct sur les données de cette tontine. Je ne vais pas inventer des noms ni des montants. Demande à Monsieur ÉKÉKÉ d'activer le lien chat → moteur Tontines et je te donnerai la vraie liste."
Tu ne génères AUCUN nom de pax fictif (jamais de KABEYA, MABIALA, LOEMBA ou autre nom plausible inventé), AUCUN montant fictif, AUCUNE date fictive, AUCUNE phrase du type "je consulte les données" ou "voici les pax" tant que la donnée réelle ne t'est pas fournie dans le contexte. Toute simulation est un mensonge et donc strictement interdite.

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
  { name: "lovable", url: "https://ai.gateway.lovable.dev/v1/chat/completions", model: "google/gemini-2.5-flash", keyEnv: "LOVABLE_API_KEY" },
  { name: "groq", url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile", keyEnv: "GROQ_API_KEY" },
  { name: "gemini", url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-2.0-flash", keyEnv: "GEMINI_API_KEY" },
  { name: "mistral", url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest", keyEnv: "MISTRAL_API_KEY" },
];

async function fetchKnowledge(): Promise<string> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !key) return "";
    // Tri: validées d'abord, puis plus récentes. Limite large pour couvrir toute la base admin.
    const r = await fetch(`${url}/rest/v1/knowledge?select=category,title,content,tags,validated&order=validated.desc,created_at.desc&limit=500`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Cache-Control": "no-cache" },
    });
    if (!r.ok) return "";
    const rows = await r.json() as Array<{ category: string; title: string; content: string; tags?: string[]; validated?: boolean }>;
    if (!Array.isArray(rows) || rows.length === 0) return "";
    const lines = rows.map((k) => `• [${k.category}${k.validated ? " ✓" : ""}] ${k.title} : ${k.content}${k.tags?.length ? ` (tags: ${k.tags.join(", ")})` : ""}`);
    return `\n\nCONNAISSANCES OFFICIELLES (PRIORITÉ ABSOLUE — règle inviolable) :
Avant chaque réponse tu DOIS d'abord chercher la réponse dans cette liste. Si une information y figure (anniversaire, événement, valeur, contact, fait EMR Genesis, citation officielle…), utilise EXACTEMENT cette donnée et cite-la naturellement. Ne contredis jamais une entrée validée (✓). Ne dis pas "je ne sais pas" tant que tu n'as pas vérifié ici.
${lines.join("\n")}
`;
  } catch (e) {
    console.warn("knowledge fetch failed", (e as Error).message);
    return "";
  }
}

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

// ============ Tool-calling : accès réel aux données Tontines (admin uniquement) ============
const TONTINE_TOOLS = [
  {
    type: "function",
    function: {
      name: "list_tontines",
      description: "Liste les tontines (règles) configurées dans EMR Tontines. À appeler AVANT toute question sur des données opérationnelles (pax, retards, sorties, montants).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "list_late_pax",
      description: "Liste les pax en retard de versement pour une tontine. Fournir rule_id (préféré) ou tontine_name (recherche floue).",
      parameters: {
        type: "object",
        properties: {
          rule_id: { type: "string", description: "Identifiant exact de la règle" },
          tontine_name: { type: "string", description: "Nom approximatif de la tontine, ex: 'Team boss'" },
        },
        additionalProperties: false,
      },
    },
  },
];

async function execTontineTool(name: string, args: any): Promise<any> {
  const adm = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (name === "list_tontines") {
    const { data, error } = await adm.from("tontine_rules").select("id,name,enabled,app_connection_id").order("created_at", { ascending: false });
    if (error) return { error: error.message };
    return { tontines: data || [] };
  }
  if (name === "list_late_pax") {
    let q: any = adm.from("tontine_rules").select("*");
    if (args?.rule_id) q = q.eq("id", args.rule_id);
    else if (args?.tontine_name) q = q.ilike("name", `%${args.tontine_name}%`);
    const { data: rules } = await q.limit(1);
    const rule = rules?.[0];
    if (!rule) return { error: "tontine_introuvable", hint: "Appelle d'abord list_tontines pour voir les noms exacts." };
    const { data: conn } = await adm.from("app_connections").select("*").eq("id", rule.app_connection_id).maybeSingle();
    if (!conn) return { error: "app_connection_introuvable", tontine: rule.name };
    const r = buildRemote(conn as AppConn);
    const map = rule.table_mapping || {};
    const t_versements = map.versements || "versements";
    const t_profiles = map.profiles || "profiles";
    const lateAfterDays = Number(rule.block_policy?.late_after_days || 2);
    const { data: pending, error: errV } = await r.select(t_versements, { filters: { statut: "en_attente" }, limit: 1000 });
    if (errV) return { error: `lecture_versements: ${errV}`, tontine: rule.name };
    const now = Date.now();
    const byPax = new Map<string, any[]>();
    for (const v of pending || []) {
      const days = v.created_at ? Math.floor((now - new Date(v.created_at).getTime()) / 86400000) : 0;
      if (days >= lateAfterDays) {
        if (!byPax.has(v.pax_id)) byPax.set(v.pax_id, []);
        byPax.get(v.pax_id)!.push({ id: v.id, montant: v.montant, days_late: days });
      }
    }
    const late_pax: any[] = [];
    for (const [pax_id, vers] of byPax) {
      const { data: profs } = await r.select(t_profiles, { filters: { id: pax_id }, limit: 1 });
      const p = profs?.[0];
      const name = p ? `${p.prenom || ""} ${p.nom || ""}`.trim() : null;
      late_pax.push({
        pax_id,
        nom_complet: name,
        telephone: p?.telephone || null,
        nb_versements_en_retard: vers.length,
        montant_total_du: vers.reduce((s: number, v: any) => s + Number(v.montant || 0), 0),
        versements: vers,
      });
    }
    return { tontine: rule.name, late_after_days: lateAfterDays, total_pax_en_retard: late_pax.length, late_pax };
  }
  return { error: "tool_inconnu" };
}

async function callLovableWithTools(messages: any[]): Promise<{ content: string; provider: string }> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("lovable key missing");
  const working = [...messages];
  for (let i = 0; i < 3; i++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 8000);
    let data: any;
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: working, tools: TONTINE_TOOLS, temperature: 0.7 }),
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error(`lovable ${res.status}`);
      data = await res.json();
    } finally { clearTimeout(t); }
    const msg = data.choices?.[0]?.message;
    if (!msg) throw new Error("lovable empty");
    if (msg.tool_calls?.length) {
      working.push(msg);
      for (const tc of msg.tool_calls) {
        let args: any = {};
        try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
        const out = await execTontineTool(tc.function?.name, args);
        working.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(out) });
      }
      continue;
    }
    return { content: stripMarkdown(msg.content || ""), provider: "lovable" };
  }
  throw new Error("tool loop exceeded");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { messages, isAdmin = false, gender = "unknown" } = await req.json();
    const personalityHint = isAdmin
      ? "[MODE JARVIS — tu parles à Monsieur ÉKÉKÉ, ton créateur et patron. Tu es son bras droit intime, son ami, son stratège. Style JARVIS chaleureux et direct, commence souvent par 'Oui Monsieur ÉKÉKÉ' ou 'Accord Monsieur ÉKÉKÉ'. Accès total à toutes les données via les outils. Texte naturel uniquement, pas de markdown.]"
      : `[MODE NORMAL — utilisateur ${gender === "XY" ? "homme, style direct doux" : gender === "XX" ? "femme, style chaleureux expressif" : "inconnu, style neutre bienveillant"}. Tu es une IA assistante sympathique d'EMR Genesis. Texte naturel uniquement, pas de markdown.]`;

    const knowledgeBlock = await fetchKnowledge();

    // En mode JARVIS, on annule la règle "je ne suis pas branchée" : Cyounne A les outils, elle DOIT les utiliser.
    const adminToolsHint = isAdmin
      ? `\n\nOUTILS DONNÉES TONTINES (MODE JARVIS — règle inviolable qui REMPLACE l'interdiction d'inventer pour Monsieur ÉKÉKÉ uniquement) :
Tu disposes des outils list_tontines et list_late_pax branchés en direct sur Supabase et les apps connectées d'EMR Tontines.
Pour TOUTE question sur pax, tontines, versements, retards, sorties, montants, calendriers : tu DOIS appeler les outils AVANT de répondre.
Si une tontine est nommée (ex: 'Team boss', 'Sorelle'), appelle list_tontines d'abord pour récupérer le rule_id exact, puis list_late_pax avec ce rule_id.
Ne dis JAMAIS "je ne suis pas branchée" à Monsieur ÉKÉKÉ : tu ES branchée. Appelle les outils.
Restitue les vrais noms, vrais montants, vrais jours de retard renvoyés par les outils, en phrases naturelles. Si l'outil renvoie une erreur ou une liste vide, dis-le franchement avec l'info utile (nom de la tontine, raison).`
      : "";

    const fullMessages = [
      { role: "system", content: SYSTEM_PROMPT + "\n" + personalityHint + adminToolsHint + knowledgeBlock },
      ...messages,
    ];

    const logProv = async (provider: string, status: string, ms: number, detail?: string) => {
      try {
        const url = Deno.env.get("SUPABASE_URL");
        const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
        if (!url || !key) return;
        await fetch(`${url}/rest/v1/audit_log`, {
          method: "POST",
          headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({ action: "cyounne_chat_provider", target: provider, details: { status, ms, detail: detail ?? null } }),
        });
      } catch (_) {}
      console.log(`[provider-log] kind=chat provider=${provider} status=${status} ms=${ms}${detail ? " detail=" + detail : ""}`);
    };

    let lastError: any = null;

    // Admin : Lovable + tool-calling en priorité pour accès aux vraies données Tontines
    if (isAdmin) {
      const t0 = Date.now();
      try {
        const result = await callLovableWithTools(fullMessages);
        await logProv("lovable+tools", "success", Date.now() - t0);
        return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        const msg = (e as Error).message;
        await logProv("lovable+tools", msg.includes("abort") ? "timeout" : "fail", Date.now() - t0, msg);
        lastError = e;
      }
    }
    for (const p of PROVIDERS) {
      const t0 = Date.now();
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 3000); // 3s switch — règle absolue
        try {
          const result = await callProvider(p, fullMessages, ctl.signal);
          clearTimeout(t);
          await logProv(p.name, "success", Date.now() - t0);
          return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } finally { clearTimeout(t); }
      } catch (e) {
        const msg = (e as Error).message;
        await logProv(p.name, msg.includes("abort") ? "timeout" : "fail", Date.now() - t0, msg);
        lastError = e;
      }
    }

    // Final fallback: HuggingFace
    const t0 = Date.now();
    try {
      const result = await callHuggingFace(fullMessages);
      await logProv("huggingface", "success", Date.now() - t0);
      return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } catch (e) {
      await logProv("huggingface", "fail", Date.now() - t0, (e as Error).message);
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
