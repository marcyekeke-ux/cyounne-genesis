import { cn } from "@/lib/utils";

export type AvatarState = "idle" | "listening" | "speaking" | "alert" | "thinking" | "stress" | "joy";

interface CyounneAvatarProps {
  state?: AvatarState;
  gender?: "XY" | "XX" | "unknown";
  size?: number;
  className?: string;
}

/**
 * Avatar émotionnel Cyounne. Reflète écoute, parole, réflexion, stress, joie, alerte.
 * Transitions fluides via CSS transition + animation conditionnelle.
 */
export function CyounneAvatar({ state = "idle", gender = "unknown", size = 220, className }: CyounneAvatarProps) {
  const isFemale = gender === "XX";

  // Palette émotionnelle dynamique
  const palette: Record<AvatarState, { primary: string; secondary: string; glow: string }> = {
    idle: {
      primary: isFemale ? "hsl(290 95% 70%)" : "hsl(230 95% 62%)",
      secondary: isFemale ? "hsl(320 95% 65%)" : "hsl(275 90% 65%)",
      glow: isFemale ? "hsl(290 95% 70% / 0.5)" : "hsl(230 95% 62% / 0.5)",
    },
    listening: {
      primary: "hsl(190 95% 60%)",
      secondary: "hsl(210 95% 65%)",
      glow: "hsl(190 95% 60% / 0.6)",
    },
    speaking: {
      primary: isFemale ? "hsl(310 95% 68%)" : "hsl(250 95% 65%)",
      secondary: isFemale ? "hsl(330 95% 62%)" : "hsl(280 95% 60%)",
      glow: isFemale ? "hsl(310 95% 68% / 0.7)" : "hsl(250 95% 65% / 0.7)",
    },
    thinking: {
      primary: "hsl(45 90% 60%)",
      secondary: "hsl(35 95% 55%)",
      glow: "hsl(45 90% 60% / 0.5)",
    },
    stress: {
      primary: "hsl(15 90% 55%)",
      secondary: "hsl(0 85% 60%)",
      glow: "hsl(10 90% 55% / 0.7)",
    },
    joy: {
      primary: "hsl(140 80% 55%)",
      secondary: "hsl(170 85% 50%)",
      glow: "hsl(150 85% 55% / 0.6)",
    },
    alert: {
      primary: "hsl(0 85% 62%)",
      secondary: "hsl(15 90% 55%)",
      glow: "hsl(0 85% 62% / 0.7)",
    },
  };

  const { primary, secondary, glow } = palette[state] ?? palette.idle;

  const orbAnimation =
    state === "speaking" ? "pulse-glow 1s ease-in-out infinite"
    : state === "thinking" ? "float-y 2.5s ease-in-out infinite"
    : state === "stress" ? "pulse-glow 0.5s ease-in-out infinite"
    : state === "joy" ? "pulse-glow 1.4s ease-in-out infinite"
    : state === "idle" ? "float-y 4s ease-in-out infinite"
    : undefined;

  return (
    <div
      className={cn("relative flex items-center justify-center transition-all duration-500", className)}
      style={{ width: size, height: size }}
    >
      {(state === "listening" || state === "speaking" || state === "joy") && (
        <>
          <span
            className="absolute inset-0 rounded-full animate-ripple transition-opacity duration-500"
            style={{ background: `radial-gradient(circle, ${primary} 0%, transparent 70%)`, opacity: 0.4 }}
          />
          <span
            className="absolute inset-0 rounded-full animate-ripple transition-opacity duration-500"
            style={{ background: `radial-gradient(circle, ${secondary} 0%, transparent 70%)`, opacity: 0.3, animationDelay: "0.6s" }}
          />
        </>
      )}

      <div
        className={cn(
          "relative rounded-full overflow-hidden transition-all duration-700",
          state === "alert" || state === "stress" ? "ring-4 ring-destructive/70" : "",
        )}
        style={{
          width: size * 0.78,
          height: size * 0.78,
          background: `radial-gradient(circle at 30% 30%, ${secondary} 0%, ${primary} 45%, hsl(245 60% 8%) 100%)`,
          boxShadow: `0 0 60px ${glow}, inset 0 0 80px ${secondary}50`,
          animation: orbAnimation,
          transition: "background 0.7s ease, box-shadow 0.7s ease",
        }}
      >
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-60">
          <circle cx="50" cy="50" r="44" fill="none" stroke={primary} strokeWidth="0.4" strokeDasharray="2 4" />
          <circle cx="50" cy="50" r="38" fill="none" stroke={secondary} strokeWidth="0.4" strokeDasharray="3 3" />
          <circle cx="50" cy="50" r="30" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.3" />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="flex gap-4 transition-transform duration-500"
               style={{
                 transform: state === "thinking" ? "translateY(-2px) scale(0.85)"
                          : state === "stress" ? "scaleY(0.6)"
                          : state === "joy" ? "scaleY(0.7) translateY(-1px)"
                          : "none",
               }}>
            <span
              className="block w-2 h-3 rounded-full bg-white/95 animate-blink"
              style={{
                boxShadow: `0 0 10px white`,
                animationDuration: state === "stress" ? "0.4s" : state === "thinking" ? "1.6s" : "3s",
              }}
            />
            <span
              className="block w-2 h-3 rounded-full bg-white/95 animate-blink"
              style={{
                boxShadow: `0 0 10px white`,
                animationDelay: "0.2s",
                animationDuration: state === "stress" ? "0.4s" : state === "thinking" ? "1.6s" : "3s",
              }}
            />
          </div>
          <div className="flex items-end gap-[3px] h-5 transition-all duration-300">
            {[0.4, 0.7, 1, 0.7, 0.4].map((h, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-white origin-bottom"
                style={{
                  height: `${h * 100}%`,
                  animation: state === "speaking"
                    ? `wave-bar 0.6s ease-in-out ${i * 0.08}s infinite`
                    : state === "stress"
                    ? `wave-bar 0.25s ease-in-out ${i * 0.05}s infinite`
                    : state === "joy"
                    ? `wave-bar 0.8s ease-in-out ${i * 0.1}s infinite`
                    : undefined,
                  transform: state === "speaking" || state === "stress" || state === "joy" ? undefined : "scaleY(0.3)",
                  opacity: state === "idle" || state === "thinking" ? 0.5 : 1,
                  transition: "opacity 0.4s ease, transform 0.4s ease",
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <span className="absolute w-2 h-2 rounded-full bg-white/80" style={{ top: "10%", left: "50%", animation: "float-y 3s ease-in-out infinite" }} />
      <span className="absolute w-1.5 h-1.5 rounded-full bg-accent" style={{ bottom: "12%", right: "18%", animation: "float-y 4s ease-in-out 0.5s infinite" }} />
    </div>
  );
}
