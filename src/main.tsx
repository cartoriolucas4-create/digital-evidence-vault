import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./planner-overrides.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemento #root não encontrado.");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/digital-evidence-vault/sw.js", { scope: "/digital-evidence-vault/" }).catch((error) => console.warn("MCR Service Worker", error));
  });
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
