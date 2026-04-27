import { cn } from "@/lib/utils";

export type AvatarState = "idle" | "listening" | "speaking" | "alert";

interface CyounneAvatarProps {
  state?: AvatarState;
  gender?: "XY" | "XX" | "unknown";
  size?: number;
  className?: string;
}

/**
 * Avatar futuriste animé. Pas de modèle 3D externe — orbe SVG/CSS
 * léger, rendu à la "Jarvis", avec ondes sonores et yeux/bouche animés.
 */
export function CyounneAvatar({ state = "idle", gender = "unknown", size = 220, className }: CyounneAvatarProps) {
  const isFemale = gender === "XX";
  const primary = isFemale ? "hsl(290 95% 70%)" : "hsl(230 95% 62%)";
  const secondary = isFemale ? "hsl(320 95% 65%)" : "hsl(275 90% 65%)";

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      {/* Halo ripple — visible quand parle/écoute */}
      {(state === "listening" || state === "speaking") && (
        <>
          <span
            className="absolute inset-0 rounded-full animate-ripple"
            style={{ background: `radial-gradient(circle, ${primary} 0%, transparent 70%)`, opacity: 0.4 }}
          />
          <span
            className="absolute inset-0 rounded-full animate-ripple"
            style={{ background: `radial-gradient(circle, ${secondary} 0%, transparent 70%)`, opacity: 0.3, animationDelay: "0.6s" }}
          />
        </>
      )}

      {/* Orbe principal */}
      <div
        className={cn(
          "relative rounded-full overflow-hidden",
          state === "alert" ? "ring-4 ring-destructive/70" : "",
        )}
        style={{
          width: size * 0.78,
          height: size * 0.78,
          background: `radial-gradient(circle at 30% 30%, ${secondary} 0%, ${primary} 45%, hsl(245 60% 8%) 100%)`,
          boxShadow: state === "alert"
            ? `0 0 60px hsl(0 85% 62% / 0.7), inset 0 0 80px hsl(0 85% 62% / 0.4)`
            : `0 0 60px ${primary}80, inset 0 0 80px ${secondary}50`,
          animation: state === "speaking" ? "pulse-glow 1s ease-in-out infinite" : state === "idle" ? "float-y 4s ease-in-out infinite" : undefined,
        }}
      >
        {/* Couches orbites */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full opacity-60">
          <circle cx="50" cy="50" r="44" fill="none" stroke={primary} strokeWidth="0.4" strokeDasharray="2 4" />
          <circle cx="50" cy="50" r="38" fill="none" stroke={secondary} strokeWidth="0.4" strokeDasharray="3 3" />
          <circle cx="50" cy="50" r="30" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.3" />
        </svg>

        {/* Yeux + bouche */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <div className="flex gap-4">
            <span className="block w-2 h-3 rounded-full bg-white/95 animate-blink" style={{ boxShadow: `0 0 10px white` }} />
            <span className="block w-2 h-3 rounded-full bg-white/95 animate-blink" style={{ boxShadow: `0 0 10px white`, animationDelay: "0.2s" }} />
          </div>
          {/* bouche / ondes vocales */}
          <div className="flex items-end gap-[3px] h-5">
            {[0.4, 0.7, 1, 0.7, 0.4].map((h, i) => (
              <span
                key={i}
                className="w-[3px] rounded-full bg-white origin-bottom"
                style={{
                  height: `${h * 100}%`,
                  animation: state === "speaking" ? `wave-bar 0.6s ease-in-out ${i * 0.08}s infinite` : undefined,
                  transform: state === "speaking" ? undefined : "scaleY(0.3)",
                  opacity: state === "idle" ? 0.5 : 1,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Petites particules orbitales */}
      <span className="absolute w-2 h-2 rounded-full bg-white/80" style={{ top: "10%", left: "50%", animation: "float-y 3s ease-in-out infinite" }} />
      <span className="absolute w-1.5 h-1.5 rounded-full bg-accent" style={{ bottom: "12%", right: "18%", animation: "float-y 4s ease-in-out 0.5s infinite" }} />
    </div>
  );
}
