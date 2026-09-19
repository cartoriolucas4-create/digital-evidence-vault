import { createFileRoute } from "@tanstack/react-router";
import App from "../App";
import "../index.css";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Central de Desempenho — Concursos" },
      {
        name: "description",
        content: "Controle de questões, desempenho e metas para concursos públicos.",
      },
    ],
  }),
  component: App,
});
