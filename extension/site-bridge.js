(() => {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'REQUEST_SESSION') return;
    try {
      const key = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      const raw = key ? localStorage.getItem(key) : null;
      if (!raw) return;
      const session = JSON.parse(raw);
      chrome.runtime.sendMessage({ type: 'SITE_SESSION', session }).catch(() => {});
    } catch {}
  });
})();
