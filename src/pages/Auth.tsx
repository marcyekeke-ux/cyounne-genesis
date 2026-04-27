import { Navigate } from "react-router-dom";

// Cyounne n'a plus de système de comptes propre.
// L'authentification se fait depuis EMR Genesis. Toute visite ici redirige vers le chat.
export default function Auth() {
  return <Navigate to="/chat" replace />;
}
