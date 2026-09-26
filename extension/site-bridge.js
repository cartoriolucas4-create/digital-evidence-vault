(() => {
  function sendSession() {
    try {
      const key = Object.keys(localStorage).find(k => k.startsWith("sb-") && k.endsWith("-auth-token"));
      const raw = key ? localStorage.getItem(key) : null;
      if (!raw) return false;
      const session = JSON.parse(raw);
      if (!session?.access_token) return false;
      chrome.runtime.sendMessage({ type: "SITE_SESSION", session }).catch(() => {});
      return true;
    } catch {
      return false;
    }
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "REQUEST_SESSION") sendSession();
  });

  // Also send an already-existing session automatically when GitHub Pages loads.
  sendSession();

  // Supabase may finish/refresh authentication after the page is initially loaded.
  let attempts = 0;
  const timer = setInterval(() => {
    attempts++;
    if (sendSession() || attempts >= 20) clearInterval(timer);
  }, 1000);
})();