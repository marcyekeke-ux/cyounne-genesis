import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CyounneAvatar, AvatarState } from "@/components/cyounne/CyounneAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useVoice, speak } from "@/hooks/useVoice";
import {
  Mic, MicOff, Send, Volume2, VolumeX, Image as ImageIcon, Sparkles, Loader2, ShieldCheck,
  FileText, Paperclip, Stethoscope, Users as UsersIcon, Bell, BarChart3, Camera, FileCheck, Brain,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Msg { id: string; role: "user" | "assistant"; content: string; provider?: string; }
type Step = { key: string; label: string; status: "pending" | "running" | "done" | "error"; detail?: string };
interface ProgressMsg { id: string; role: "progress"; steps: Step[]; }
type AnyMsg = Msg | ProgressMsg;

const QUICK_ACTIONS_USER = [
  "Explique-moi EMR Genesis",
  "Comment fonctionne le Paxage ?",
  "Quels sont les niveaux des membres ?",
];

const QUICK_ACTIONS_ADMIN = [
  "cyounne vision totale",
  "cyounne rapport reel",
  "cyounne performance",
  "cyounne risques",
  "cyounne strategie",
];

function clean(text: string): string {
  if (!text) return text;
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\bMr\.?\s*EKEKE\b/gi, "Monsieur ÉKÉKÉ")
    .replace(/\bMarcy-B\s+EKEKE\b/gi, "Monsieur ÉKÉKÉ");
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export default function Chat() {
  const { isAdmin } = useAuth();
  const [messages, setMessages] = useState<AnyMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [voiceMode, setVoiceMode] = useState(false);
  const [muted, setMuted] = useState(false);
  const [emrOpen, setEmrOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  // Pas de compte utilisateur côté Cyounne — on a un user/profile factice.
  const user: any = null;
  const profile: any = null;
  const gender = "unknown" as "XY" | "XX" | "unknown";

  const voice = useVoice({
    onWake: () => setAvatarState("listening"),
    onTranscript: (text) => { setAvatarState("idle"); sendMessage(text); },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Mise à jour d'une étape de progression dans un message progress
  function updateProgress(progressId: string, key: string, patch: Partial<Step>) {
    setMessages((p) => p.map((m) => {
      if (m.id !== progressId || (m as any).role !== "progress") return m;
      const pm = m as ProgressMsg;
      return { ...pm, steps: pm.steps.map((s) => s.key === key ? { ...s, ...patch } : s) };
    }));
  }

  function pushProgress(steps: Step[]): string {
    const id = crypto.randomUUID();
    setMessages((p) => [...p, { id, role: "progress", steps }]);
    return id;
  }

  async function persistMessage(m: Omit<Msg, "id"> & { id?: string }) {
    if (!user || !conversationId) return null;
    const { data } = await supabase.from("messages").insert({
      conversation_id: conversationId, user_id: user.id,
      role: m.role, content: m.content, provider: m.provider,
    }).select("id").single();
    return data?.id ?? null;
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setBusy(true);
    setAvatarState("speaking");
    persistMessage(userMsg);

    try {
      const history = [...messages, userMsg].slice(-12).map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("cyounne-chat", {
        body: { messages: history, isAdmin, gender },
      });
      if (error) throw error;
      const cleaned = clean(data?.content ?? "Aucune donnée exploitable disponible.");
      const reply: Msg = { id: crypto.randomUUID(), role: "assistant", content: cleaned, provider: data?.provider };
      setMessages((p) => [...p, reply]);
      persistMessage(reply);
      if (!muted && voiceMode) await speak(reply.content, gender, supabase);
    } catch (e: any) {
      console.error(e);
      toast.error("Erreur Cyounne : " + (e?.message ?? ""));
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content: "Aucune donnée exploitable disponible." }]);
    } finally {
      setBusy(false);
      setAvatarState("idle");
    }
  }

  async function analyzeImage(file: File) {
    setBusy(true); setAvatarState("speaking");
    try {
      const b64 = await fileToBase64(file);
      const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: `Image envoyée : ${file.name}` };
      setMessages((p) => [...p, userMsg]); persistMessage(userMsg);
      const { data, error } = await supabase.functions.invoke("cyounne-vision", {
        body: { imageBase64: b64, mimeType: file.type, prompt: "Analyse cette image en français. Identifie personnes, logos, texte (OCR) et contexte. Sois factuel. Texte naturel uniquement, pas de markdown." },
      });
      if (error) throw error;
      const reply: Msg = { id: crypto.randomUUID(), role: "assistant", content: clean(data?.analysis ?? "Analyse impossible, données insuffisantes"), provider: "gemini-vision" };
      setMessages((p) => [...p, reply]); persistMessage(reply);
      if (!muted && voiceMode) await speak(reply.content, gender, supabase);
    } catch (e: any) {
      toast.error("Vision : " + (e?.message ?? "erreur"));
    } finally { setBusy(false); setAvatarState("idle"); }
  }

  async function analyzeDocument(file: File) {
    setBusy(true); setAvatarState("speaking");
    try {
      const b64 = await fileToBase64(file);
      const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: `Document envoyé : ${file.name}` };
      setMessages((p) => [...p, userMsg]); persistMessage(userMsg);
      const { data, error } = await supabase.functions.invoke("cyounne-doc", {
        body: { fileBase64: b64, mimeType: file.type || "application/pdf", fileName: file.name },
      });
      if (error) throw error;
      const reply: Msg = { id: crypto.randomUUID(), role: "assistant", content: clean(data?.analysis ?? "Analyse impossible, données insuffisantes"), provider: "gemini-doc" };
      setMessages((p) => [...p, reply]); persistMessage(reply);
      if (!muted && voiceMode) await speak(reply.content, gender, supabase);
    } catch (e: any) {
      toast.error("Document : " + (e?.message ?? "erreur"));
    } finally { setBusy(false); setAvatarState("idle"); }
  }

  const toggleVoiceMode = () => {
    if (voiceMode) { voice.stop(); setVoiceMode(false); }
    else {
      if (!voice.supported) { toast.error("Reconnaissance vocale non supportée."); return; }
      voice.start(); setVoiceMode(true); setAvatarState("listening");
      toast.success("Mode vocal activé. Dites « Cyounne »...");
    }
  };

  const send = () => sendMessage(input);
  const quickActions = isAdmin ? QUICK_ACTIONS_ADMIN : QUICK_ACTIONS_USER;

  // Capacités Mode EMR — différenciées admin / pax
  const emrCapsUser = [
    { icon: Camera, label: "Analyser une photo", desc: "Envoyez une image, Cyounne décrit et fait l'OCR.", action: () => { setEmrOpen(false); imageRef.current?.click(); } },
    { icon: FileCheck, label: "Analyser un document", desc: "PDF, Word, Excel — résumé et points clés.", action: () => { setEmrOpen(false); docRef.current?.click(); } },
    { icon: Stethoscope, label: "Conseil EMR", desc: "Posez une question sur EMR Genesis, Paxage, niveaux.", action: () => { setEmrOpen(false); sendMessage("Explique-moi EMR Genesis et le Paxage."); } },
    { icon: Brain, label: "Mode vocal", desc: "Parlez à Cyounne, elle répond à la voix.", action: () => { setEmrOpen(false); if (!voiceMode) toggleVoiceMode(); } },
  ];
  const emrCapsAdmin = [
    ...emrCapsUser,
    { icon: UsersIcon, label: "Voir les membres", desc: "Liste complète, niveaux, scores de confiance.", action: () => { setEmrOpen(false); toast.info("Ouvrez Vision Totale via le bouton Admin"); } },
    { icon: Bell, label: "Alertes actives", desc: "Incidents non résolus, push OneSignal.", action: () => { setEmrOpen(false); toast.info("Ouvrez Vision Totale via le bouton Admin"); } },
    { icon: BarChart3, label: "Rapport réel", desc: "Génère un rapport factuel (aucune invention).", action: () => { setEmrOpen(false); sendMessage("cyounne rapport reel"); } },
    { icon: FileText, label: "Stratégie", desc: "Analyse stratégique, risques et recommandations.", action: () => { setEmrOpen(false); sendMessage("cyounne strategie"); } },
  ];
  const emrCaps = isAdmin ? emrCapsAdmin : emrCapsUser;

  return (
    <div className="flex flex-col h-screen">
      <div className="px-4 md:px-8 py-4 border-b border-border/60 glass flex items-center gap-4">
        <CyounneAvatar state={avatarState} gender={gender} size={64} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display font-bold text-lg">Cyounne</h1>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-accent">
                <ShieldCheck className="w-3 h-3" /> Mode Admin
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {avatarState === "listening" ? "Écoute..." : avatarState === "speaking" ? "Cyounne parle" : "Prête à analyser"}
            {voice.interim && <span className="ml-2 italic opacity-70">« {voice.interim} »</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setEmrOpen(true)} className="hidden sm:flex">
            <Stethoscope className="w-3.5 h-3.5 mr-1" /> Mode E.M.R
          </Button>
          <Button size="icon" variant="outline" onClick={() => setEmrOpen(true)} className="sm:hidden" title="Mode EMR">
            <Stethoscope className="w-4 h-4" />
          </Button>
          <Button size="icon" variant={voiceMode ? "default" : "outline"} onClick={toggleVoiceMode} title="Mode vocal">
            {voiceMode ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant="outline" onClick={() => setMuted((m) => !m)} title="Mute">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-8 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto text-center py-20">
            <CyounneAvatar state="idle" size={180} className="mx-auto" />
            <h2 className="mt-6 font-display text-2xl font-bold text-gradient">Bonjour {profile?.display_name ?? ""}</h2>
            <p className="mt-2 text-muted-foreground text-sm">
              {isAdmin ? "Oui Monsieur ÉKÉKÉ, je vous écoute." : "Je suis Cyounne, l'intelligence centrale de EMR Genesis. Comment puis-je vous aider ?"}
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex animate-fade-in", m.role === "user" ? "justify-end" : "justify-start")}>
            <Card className={cn(
              "max-w-[85%] md:max-w-[70%] px-4 py-3 text-sm leading-relaxed",
              m.role === "user" ? "bg-gradient-primary text-primary-foreground border-transparent shadow-elegant" : "glass",
            )}>
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.provider && <div className="mt-2 text-[10px] uppercase tracking-widest opacity-50">via {m.provider}</div>}
            </Card>
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <Card className="glass px-4 py-3 text-sm flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-muted-foreground">Cyounne réfléchit...</span>
            </Card>
          </div>
        )}
      </div>

      <div className="px-3 md:px-8 pb-2 flex gap-2 overflow-x-auto">
        {quickActions.map((q) => (
          <button
            key={q}
            onClick={() => sendMessage(q)}
            disabled={busy}
            className="shrink-0 px-3 py-1.5 rounded-full text-xs border border-border/60 glass hover:border-accent/60 transition-colors flex items-center gap-1.5"
          >
            <Sparkles className="w-3 h-3 text-accent" />
            {q}
          </button>
        ))}
      </div>

      <div className="px-3 md:px-8 pb-4 pt-2 border-t border-border/60 glass">
        <div className="flex items-end gap-2">
          <input
            ref={imageRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => e.target.files?.[0] && analyzeImage(e.target.files[0])}
          />
          <input
            ref={docRef} type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && analyzeDocument(e.target.files[0])}
          />
          <Button size="icon" variant="outline" onClick={() => imageRef.current?.click()} disabled={busy} title="Envoyer une photo">
            <ImageIcon className="w-4 h-4" />
          </Button>
          <Button size="icon" variant="outline" onClick={() => docRef.current?.click()} disabled={busy} title="Envoyer un document">
            <Paperclip className="w-4 h-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={isAdmin ? "Donnez un ordre à Cyounne, Monsieur ÉKÉKÉ..." : "Écrivez à Cyounne..."}
            className="min-h-[52px] max-h-40 resize-none bg-background/40"
            disabled={busy}
          />
          <Button onClick={send} disabled={busy || !input.trim()} className="bg-gradient-primary text-primary-foreground" size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Mode E.M.R */}
      <Sheet open={emrOpen} onOpenChange={setEmrOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-accent" />
              <span className="font-display text-gradient">Mode E.M.R — Capacités de Cyounne</span>
            </SheetTitle>
            <SheetDescription>
              {isAdmin ? "Capacités étendues administrateur." : "Voici ce que Cyounne peut faire pour vous."}
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 py-4">
            {emrCaps.map((c) => {
              const Icon = c.icon;
              return (
                <button
                  key={c.label}
                  onClick={c.action}
                  className="text-left p-4 rounded-xl border border-border/60 glass hover:border-accent/60 hover:-translate-y-0.5 transition-all"
                >
                  <Icon className="w-5 h-5 text-accent mb-2" />
                  <div className="font-semibold text-sm">{c.label}</div>
                  <div className="text-[11px] text-muted-foreground mt-1">{c.desc}</div>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
