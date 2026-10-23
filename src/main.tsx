import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./planner-overrides.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Elemento #root não encontrado.");
}

// GitHub Pages must always load the newest static bundle. Unregister any
// previously installed worker for this app so an older deployment cannot
// keep controlling the page after an update.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const appPath = new URL(import.meta.env.BASE_URL || "/", window.location.origin).pathname;
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(
        registrations
          .filter((registration) => {
            const scopePath = new URL(registration.scope).pathname;
            return scopePath === appPath || scopePath.startsWith(appPath);
          })
          .map((registration) => registration.unregister()),
      ))
      .catch((error) => console.warn("[MCR] Não foi possível limpar o service worker antigo:", error));
  });
}

// Show a visible diagnostic instead of leaving a blank screen if startup fails.
window.addEventListener("error", (event) => {
  console.error("[MCR] Erro de inicialização:", event.error || event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  console.error("[MCR] Falha assíncrona:", event.reason);
});

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
