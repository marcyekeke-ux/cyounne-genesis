import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Index() {
  const nav = useNavigate();
  useEffect(() => {
    nav("/chat", { replace: true });
  }, [nav]);
  return null;
}
