// Lot 8C — Contexte Yoh / Lingala pour messages tontine
// Génère des messages naturels, chaleureux, mélange français + lingala léger.
// Pas de markdown, quelques emojis autorisés.

export type Gender = "m" | "f" | "unknown";
export type MsgKind = "congrats" | "late_warning" | "block_warning" | "receipt_ready" | "fee_applied";

export type MsgCtx = {
  name: string;
  gender?: Gender;
  amount?: number;
  days_late?: number;
  fee?: number;
  date_sortie?: string;
  receipt_no?: string;
};

const greet = (g?: Gender) => {
  // Yoh = salutation universelle. Mbote = lingala. On alterne pour le naturel.
  const pool = ["Yoh", "Mbote", "Yoh yoh", "Sango nini"];
  return pool[Math.floor(Math.random() * pool.length)];
};

const honorific = (g?: Gender) => {
  if (g === "m") return "ndeko mobali";
  if (g === "f") return "ndeko mwasi";
  return "ndeko";
};

const fmtAmount = (n?: number) => (n ? `${Number(n).toLocaleString("fr-FR")} F` : "");

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export function buildTontineMessage(kind: MsgKind, ctx: MsgCtx): string {
  const hi = greet(ctx.gender);
  const ndeko = honorific(ctx.gender);
  const name = ctx.name || "Pax";
  const date = ctx.date_sortie ? new Date(ctx.date_sortie).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "demain";

  switch (kind) {
    case "congrats":
      return pick([
        `${hi} ${name} 🎉 Lobi ezali mokolo na yo. Sortie tontine ${date}, prépare-toi bien ${ndeko}.`,
        `${hi} ${name} ! Demain c'est ${date}, ta sortie tontine arrive. Malamu mingi ${ndeko} 💪`,
        `${hi} ${name} 🙌 Cyounne te rappelle: ${date} c'est ta sortie tontine. Sois prêt(e), to monana ${ndeko}.`,
      ]);
    case "late_warning":
      return pick([
        `${hi} ${name}, ozali na retard ya ${ctx.days_late} mikolo sur ton versement${ctx.amount ? ` de ${fmtAmount(ctx.amount)}` : ""}. Régularise vite ${ndeko}.`,
        `${hi} ${name} ⚠️ Versement en attente depuis ${ctx.days_late} jours. ${ctx.fee ? `Frais de retard: ${fmtAmount(ctx.fee)}. ` : ""}Mets-toi à jour ${ndeko}.`,
        `${hi} ${name}, soki obosani: ${ctx.days_late} mikolo retard. Cyounne te le rappelle gentiment.`,
      ]);
    case "block_warning":
      return pick([
        `${hi} ${name} 🚨 Trop de retards accumulés. Si tu ne régularises pas, ton compte tontine sera bloqué. Tika na regarder ${ndeko}.`,
        `${hi} ${name}, attention: ${ctx.days_late || "plusieurs"} retards détectés. Contact urgent avec ton Team Leader, sinon blocage.`,
      ]);
    case "receipt_ready":
      return pick([
        `${hi} ${name} ✅ Reçu N°${ctx.receipt_no || "—"} prêt pour ton versement de ${fmtAmount(ctx.amount)}. Matondi ${ndeko}.`,
        `${hi} ${name}, ton reçu est généré (N°${ctx.receipt_no || "—"}). Versement de ${fmtAmount(ctx.amount)} confirmé. Merci ${ndeko} 🙏`,
      ]);
    case "fee_applied":
      return pick([
        `${hi} ${name}, frais de retard appliqués: ${fmtAmount(ctx.fee)} (${ctx.days_late} jours). Régularise pour stopper le compteur.`,
        `${hi} ${name} ⏰ ${ctx.days_late} jours de retard = ${fmtAmount(ctx.fee)} de frais. Cyounne reste à ton écoute ${ndeko}.`,
      ]);
  }
}
