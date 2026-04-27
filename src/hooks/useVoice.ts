import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Mode vocal Cyounne :
 * - Wake word : "cyounne" ou "eh cyounne"
 * - Reconnaissance vocale (Web Speech API par défaut, fallback du navigateur)
 * - TTS (ElevenLabs via edge function, fallback speechSynthesis)
 */
export function useVoice(opts: { onWake?: () => void; onTranscript?: (text: string) => void } = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recognitionRef = useRef<any>(null);
  const onWakeRef = useRef(opts.onWake);
  const onTranscriptRef = useRef(opts.onTranscript);

  useEffect(() => { onWakeRef.current = opts.onWake; }, [opts.onWake]);
  useEffect(() => { onTranscriptRef.current = opts.onTranscript; }, [opts.onTranscript]);

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const start = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    const r = new SR();
    r.lang = "fr-FR";
    r.interimResults = true;
    r.continuous = true;
    r.onresult = (e: any) => {
      let final = "";
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interimText += t;
      }
      setInterim(interimText);
      const lower = (final + " " + interimText).toLowerCase();
      if (/(\beh\s+)?cyounne\b/.test(lower) && !final.toLowerCase().includes("cyounne ")) {
        // wake word seul
        onWakeRef.current?.();
      }
      if (final.trim()) {
        const cleaned = final.replace(/^(eh\s+)?cyounne[,.\s]*/i, "").trim();
        if (cleaned) onTranscriptRef.current?.(cleaned);
        else onWakeRef.current?.();
        setInterim("");
      }
    };
    r.onerror = (e: any) => {
      console.warn("speech error", e?.error);
      if (e?.error === "no-speech" || e?.error === "audio-capture") return;
    };
    r.onend = () => {
      // restart if still in listening mode
      if (recognitionRef.current === r) {
        try { r.start(); } catch {}
      }
    };
    recognitionRef.current = r;
    try { r.start(); setListening(true); } catch {}
  }, []);

  const stop = useCallback(() => {
    const r = recognitionRef.current;
    recognitionRef.current = null;
    if (r) { try { r.stop(); } catch {} }
    setListening(false);
    setInterim("");
  }, []);

  return { supported, listening, interim, start, stop };
}

/** Lit du texte avec ElevenLabs ; fallback speechSynthesis. */
export async function speak(text: string, gender: "XY" | "XX" | "unknown" = "XY", supabase: any) {
  try {
    const { data, error } = await supabase.functions.invoke("cyounne-tts", { body: { text, gender } });
    if (!error && data?.audio) {
      const audio = new Audio(`data:${data.mime};base64,${data.audio}`);
      await audio.play();
      return new Promise<void>((resolve) => { audio.onended = () => resolve(); });
    }
  } catch (e) {
    console.warn("tts edge failed, fallback web speech", e);
  }
  return new Promise<void>((resolve) => {
    if (!("speechSynthesis" in window)) { resolve(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "fr-FR";
    const voices = speechSynthesis.getVoices();
    const fr = voices.find((v) => v.lang.startsWith("fr") && (gender === "XX" ? v.name.toLowerCase().includes("fem") || v.name.toLowerCase().includes("aurélie") : true)) || voices.find((v) => v.lang.startsWith("fr"));
    if (fr) u.voice = fr;
    u.onend = () => resolve();
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  });
}
