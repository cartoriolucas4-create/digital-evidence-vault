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
    const baseUrl = import.meta.env.BASE_URL || "/";
    const swUrl = new URL("sw.js", window.location.origin + baseUrl).toString();
    navigator.serviceWorker.register(swUrl, { scope: new URL(baseUrl, window.location.origin).pathname }).catch((error) => console.warn("MCR Service Worker", error));
  });
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
