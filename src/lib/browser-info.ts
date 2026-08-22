export interface BrowserInfo {
  userAgent: string | null;
  uaData: unknown;
  language: string | null;
  languages: readonly string[] | null;
  platform: string | null;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  screen: { width: number; height: number; colorDepth: number; pixelDepth: number } | null;
  window: { innerWidth: number; innerHeight: number; devicePixelRatio: number } | null;
  timezone: string | null;
  utcOffsetMinutes: number | null;
  touchPoints: number | null;
  deviceType: string | null;
  online: boolean | null;
  cookieEnabled: boolean | null;
}

export function collectBrowserInfo(): BrowserInfo {
  if (typeof window === "undefined") {
    return {
      userAgent: null, uaData: null, language: null, languages: null, platform: null,
      hardwareConcurrency: null, deviceMemory: null, screen: null, window: null,
      timezone: null, utcOffsetMinutes: null, touchPoints: null, deviceType: null,
      online: null, cookieEnabled: null,
    };
  }
  const n = navigator as any;
  const tzOffset = -new Date().getTimezoneOffset();
  const scr = window.screen;
  const uaData = n.userAgentData
    ? { brands: n.userAgentData.brands, mobile: n.userAgentData.mobile, platform: n.userAgentData.platform }
    : null;
  let deviceType: string | null = null;
  if (uaData) deviceType = uaData.mobile ? "mobile" : "desktop";
  return {
    userAgent: navigator.userAgent ?? null,
    uaData,
    language: navigator.language ?? null,
    languages: navigator.languages ? Array.from(navigator.languages) : null,
    platform: n.platform ?? null,
    hardwareConcurrency: typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : null,
    deviceMemory: typeof n.deviceMemory === "number" ? n.deviceMemory : null,
    screen: scr ? { width: scr.width, height: scr.height, colorDepth: scr.colorDepth, pixelDepth: scr.pixelDepth } : null,
    window: { innerWidth: window.innerWidth, innerHeight: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    utcOffsetMinutes: tzOffset,
    touchPoints: typeof navigator.maxTouchPoints === "number" ? navigator.maxTouchPoints : null,
    deviceType,
    online: typeof navigator.onLine === "boolean" ? navigator.onLine : null,
    cookieEnabled: typeof navigator.cookieEnabled === "boolean" ? navigator.cookieEnabled : null,
  };
}

export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
