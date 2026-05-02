import { useEffect } from "react";
import Chat from "./Chat";

/**
 * Page d'intégration iframe pour EMR Genesis.
 * À coller dans Genesis :
 *   <iframe src="https://[URL_PUBLIEE]/embed" allow="microphone; camera; clipboard-write" style="width:100%;height:100%;border:0" />
 *
 * Toute modification ici est instantanément reflétée dans Genesis car l'iframe pointe sur l'URL publiée.
 */
export default function Embed() {
  useEffect(() => {
    document.documentElement.classList.add("cyounne-embed");
    // Notifie Genesis que Cyounne est prête
    try { window.parent?.postMessage({ source: "cyounne", event: "ready" }, "*"); } catch {}
    return () => document.documentElement.classList.remove("cyounne-embed");
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <Chat />
    </div>
  );
}
