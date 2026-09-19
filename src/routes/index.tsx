import { createFileRoute } from "@tanstack/react-router";
import App from "../App";
import "../index.css";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Central de Desempenho — Concursos" },
      {
        name: "description",
        content: "Controle de questões, desempenho e metas para concursos públicos.",
      },
    ],
  }),
  pendingComponent: () => (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center" }}>
        <strong>Central de Desempenho</strong>
        <div style={{ marginTop: 8, opacity: 0.65 }}>Carregando...</div>
      </div>
    </div>
  ),
  component: App,
});
