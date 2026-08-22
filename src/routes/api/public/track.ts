import { createFileRoute } from "@tanstack/react-router";
import { getRequestIP } from "@tanstack/react-start/server";
import { createHash } from "node:crypto";
import { analyzeIp, headersToObject } from "@/lib/ip-utils";

export const Route = createFileRoute("/api/public/track")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_json" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const caseId: string | undefined = body?.caseId;
        const sessionId: string | undefined = body?.sessionId;
        if (!caseId || !sessionId) {
          return new Response(JSON.stringify({ error: "missing_fields" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const directIp = getRequestIP({ xForwardedFor: false }) ?? null;
        const ipInfo = analyzeIp(request.headers, directIp);
        const rawHeaders = headersToObject(request.headers);

        const url = new URL(request.url);
        const protocol = url.protocol.replace(":", "");

        const nowIso = new Date().toISOString();
        const clientIso: string | null = body?.clientTimestamp ?? null;
        let skew: number | null = null;
        if (clientIso) {
          const c = Date.parse(clientIso);
          if (!Number.isNaN(c)) skew = Date.now() - c;
        }

        const browser = body?.browser ?? null;

        const metaForHash = {
          caseId,
          sessionId,
          ip: { ...ipInfo, port: null },
          protocol,
          headers: rawHeaders,
          method: request.method,
          path: url.pathname + url.search,
          serverTimestampUtc: nowIso,
          browser,
        };
        const metadataHash = createHash("sha256")
          .update(JSON.stringify(metaForHash))
          .digest("hex");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("access_events")
          .insert({
            case_id: caseId,
            session_id: sessionId,
            ip_direct: ipInfo.ipDirect,
            ip_proxy: ipInfo.ipProxy,
            ip_v4: ipInfo.ipV4,
            ip_v6: ipInfo.ipV6,
            ip_source: ipInfo.source,
            source_port: null,
            protocol,
            http_version: null,
            http_method: request.method,
            http_path: url.pathname + url.search,
            http_status: 200,
            user_agent: request.headers.get("user-agent"),
            headers: rawHeaders,
            server_timestamp_utc: nowIso,
            server_timezone: "UTC",
            client_timestamp: clientIso,
            clock_skew_ms: skew,
            browser,
            metadata_hash: metadataHash,
          })
          .select("id")
          .single();

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        return Response.json({ eventId: data.id, metadataHash });
      },
    },
  },
});
