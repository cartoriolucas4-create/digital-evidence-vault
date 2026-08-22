// Utilities to classify IPs — no fabrication. Returns null when unavailable.

export const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
export const IPV6_RE = /^(([0-9a-fA-F]{1,4}:){1,7}[0-9a-fA-F]{1,4}|::1|::)/;

export function classifyIp(ip: string | null | undefined): { v4: string | null; v6: string | null } {
  if (!ip) return { v4: null, v6: null };
  const stripped = ip.replace(/^\[|\]$/g, "");
  if (IPV4_RE.test(stripped)) return { v4: stripped, v6: null };
  if (stripped.startsWith("::ffff:") && IPV4_RE.test(stripped.slice(7))) {
    return { v4: stripped.slice(7), v6: null };
  }
  if (IPV6_RE.test(stripped)) return { v4: null, v6: stripped };
  return { v4: null, v6: null };
}

export interface IpAnalysis {
  ipDirect: string | null;
  ipProxy: string | null;
  ipV4: string | null;
  ipV6: string | null;
  source: "direct" | "proxy_cf" | "proxy_xff" | "unknown";
}

export function analyzeIp(headers: Headers, directIp: string | null): IpAnalysis {
  const cf = headers.get("cf-connecting-ip");
  const trueClient = headers.get("true-client-ip");
  const xff = headers.get("x-forwarded-for");

  let proxyIp: string | null = null;
  let source: IpAnalysis["source"] = "unknown";

  if (cf) {
    proxyIp = cf.trim();
    source = "proxy_cf";
  } else if (trueClient) {
    proxyIp = trueClient.trim();
    source = "proxy_cf";
  } else if (xff) {
    proxyIp = xff.split(",")[0]?.trim() ?? null;
    source = "proxy_xff";
  } else if (directIp) {
    source = "direct";
  }

  const effective = proxyIp ?? directIp;
  const { v4, v6 } = classifyIp(effective);
  return {
    ipDirect: directIp,
    ipProxy: proxyIp,
    ipV4: v4,
    ipV6: v6,
    source,
  };
}

export function headersToObject(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((v, k) => {
    // Never store cookies/authorization
    if (k === "cookie" || k === "authorization") return;
    out[k] = v;
  });
  return out;
}
