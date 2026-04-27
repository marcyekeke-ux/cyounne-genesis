import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CyounneAvatar, AvatarState } from "@/components/cyounne/CyounneAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useVoice, speak } from "@/hooks/useVoice";
import { Mic, MicOff, Send, Volume2, VolumeX, Image as ImageIcon, Sparkles, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Msg { id: string; role: "user" | "assistant"; content: string; provider?: string; }

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

export default function Chat() {
  const { user, profile, isAdmin } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const [voiceMode, setVoiceMode] = useState(false);
  const [muted, setMuted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const gender = (profile?.gender ?? "unknown") as "XY" | "XX" | "unknown";

  const voice = useVoice({
    onWake: () => {
      setAvatarState("listening");
    },
    onTranscript: (text) => {
      setAvatarState("idle");
      sendMessage(text);
    },
  });

  // Initialize conversation
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: existing } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        setConversationId(existing.id);
        const { data: msgs } = await supabase
          .from("messages")
          .select("id,role,content,provider")
          .eq("conversation_id", existing.id)
          .order("created_at", { ascending: true })
          .limit(50);
        setMessages((msgs ?? []) as Msg[]);
      } else {
        const { data: created } = await supabase
          .from("conversations")
          .insert({ user_id: user.id, title: "Conversation Cyounne", mode: isAdmin ? "admin" : "pax" })
          .select("id")
          .single();
        setConversationId(created!.id);
      }
    })();
  }, [user, isAdmin]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function persistMessage(m: Omit<Msg, "id"> & { id?: string }) {
    if (!user || !conversationId) return null;
    const { data } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      role: m.role,
      content: m.content,
      provider: m.provider,
    }).select("id").single();
    return data?.id ?? null;
  }

  async function sendMessage(text: string) {
    if (!text.trim() || !user) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setBusy(true);
    setAvatarState("speaking");

    persistMessage(userMsg);

    try {
      // Build short history (last 12)
      const history = [...messages, userMsg].slice(-12).map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("cyounne-chat", {
        body: { messages: history, isAdmin, gender },
      });
      if (error) throw error;
      const reply: Msg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data?.content ?? "Aucune donnée exploitable disponible.",
        provider: data?.provider,
      };
      setMessages((p) => [...p, reply]);
      persistMessage(reply);

      if (!muted && voiceMode) {
        await speak(reply.content, gender, supabase);
      }
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
    setBusy(true);
    setAvatarState("speaking");
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const b64 = btoa(bin);
      const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: `📷 Image envoyée : ${file.name}` };
      setMessages((p) => [...p, userMsg]);
      persistMessage(userMsg);

      const { data, error } = await supabase.functions.invoke("cyounne-vision", {
        body: { imageBase64: b64, mimeType: file.type, prompt: "Analyse cette image en français. Identifie personnes, logos, texte (OCR) et contexte. Sois factuel." },
      });
      if (error) throw error;
      const reply: Msg = { id: crypto.randomUUID(), role: "assistant", content: data?.analysis ?? "Analyse impossible, données insuffisantes", provider: "gemini-vision" };
      setMessages((p) => [...p, reply]);
      persistMessage(reply);
      if (!muted && voiceMode) await speak(reply.content, gender, supabase);
    } catch (e: any) {
      toast.error("Vision : " + (e?.message ?? "erreur"));
    } finally {
      setBusy(false);
      setAvatarState("idle");
    }
  }

  const toggleVoiceMode = () => {
    if (voiceMode) {
      voice.stop();
      setVoiceMode(false);
    } else {
      if (!voice.supported) { toast.error("Reconnaissance vocale non supportée par votre navigateur."); return; }
      voice.start();
      setVoiceMode(true);
      setAvatarState("listening");
      toast.success("Mode vocal activé. Dites « Cyounne »...");
    }
  };

  const send = () => sendMessage(input);

  const quickActions = isAdmin ? QUICK_ACTIONS_ADMIN : QUICK_ACTIONS_USER;

  return (
    <div className="flex flex-col h-screen">
      {/* Header avatar */}
      <div className="px-4 md:px-8 py-4 border-b border-border/60 glass flex items-center gap-4">
        <CyounneAvatar state={avatarState} gender={gender} size={64} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-display font-bold text-lg">Cyounne</h1>
            {isAdmin && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-accent">
                <ShieldCheck className="w-3 h-3" /> Mode Admin
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {avatarState === "listening" ? "🎙 Écoute..." : avatarState === "speaking" ? "💬 Cyounne parle" : "Prête à analyser"}
            {voice.interim && <span className="ml-2 italic opacity-70">« {voice.interim} »</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant={voiceMode ? "default" : "outline"} onClick={toggleVoiceMode} title="Mode vocal">
            {voiceMode ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          </Button>
          <Button size="icon" variant="outline" onClick={() => setMuted((m) => !m)} title="Mute">
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-8 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="max-w-2xl mx-auto text-center py-20">
            <CyounneAvatar state="idle" size={180} className="mx-auto" />
            <h2 className="mt-6 font-display text-2xl font-bold text-gradient">Bonjour {profile?.display_name ?? ""}</h2>
            <p className="mt-2 text-muted-foreground text-sm">
              {isAdmin ? "Oui Mr EKEKE, je vous écoute." : "Je suis Cyounne, l'intelligence centrale de EMR Genesis. Comment puis-je vous aider ?"}
            </p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex animate-fade-in", m.role === "user" ? "justify-end" : "justify-start")}>
            <Card
              className={cn(
                "max-w-[85%] md:max-w-[70%] px-4 py-3 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-gradient-primary text-primary-foreground border-transparent shadow-elegant"
                  : "glass",
              )}
            >
              <div className="whitespace-pre-wrap">{m.content}</div>
              {m.provider && (
                <div className="mt-2 text-[10px] uppercase tracking-widest opacity-50">via {m.provider}</div>
              )}
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

      {/* Quick actions */}
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

      {/* Input */}
      <div className="px-3 md:px-8 pb-4 pt-2 border-t border-border/60 glass">
        <div className="flex items-end gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && analyzeImage(e.target.files[0])}
          />
          <Button size="icon" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy} title="Analyser une image">
            <ImageIcon className="w-4 h-4" />
          </Button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={isAdmin ? "Donnez un ordre à Cyounne, Mr EKEKE..." : "Écrivez à Cyounne..."}
            className="min-h-[52px] max-h-40 resize-none bg-background/40"
            disabled={busy}
          />
          <Button onClick={send} disabled={busy || !input.trim()} className="bg-gradient-primary text-primary-foreground" size="icon">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
