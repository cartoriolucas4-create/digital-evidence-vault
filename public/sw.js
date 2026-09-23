const CACHE_NAME = "mcr-shell-v2";
self.addEventListener("install", (event) => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch {}
  const title = data.title || "MCR — Meu Controle de Rendimento";
  const options = {
    body: data.body || "Lembrete de estudos do MCR.",
    icon: new URL("mcr-icon.svg", self.registration.scope).href,
    badge: new URL("mcr-icon.svg", self.registration.scope).href,
    tag: data.tag || "mcr-reminder",
    renotify: true,
    data: { url: data.url || self.registration.scope },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || self.registration.scope, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.focus();
          return client.navigate(url);
        }
      }
      return self.clients.openWindow(url);
    })
  );
});