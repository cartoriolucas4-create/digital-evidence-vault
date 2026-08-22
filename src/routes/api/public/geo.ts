import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/geo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = await request.json().catch(() => ({}));
        const eventId: string | undefined = body?.eventId;
        const geo = body?.geolocation;
        if (!eventId || !geo || typeof geo.latitude !== "number" || typeof geo.longitude !== "number") {
          return new Response(JSON.stringify({ error: "invalid" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        const payload = {
          latitude: geo.latitude,
          longitude: geo.longitude,
          accuracy: typeof geo.accuracy === "number" ? geo.accuracy : null,
          altitude: typeof geo.altitude === "number" ? geo.altitude : null,
          altitudeAccuracy: typeof geo.altitudeAccuracy === "number" ? geo.altitudeAccuracy : null,
          speed: typeof geo.speed === "number" ? geo.speed : null,
          heading: typeof geo.heading === "number" ? geo.heading : null,
          deviceTimestamp: geo.deviceTimestamp ?? null,
          receivedAt: new Date().toISOString(),
        };
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin
          .from("access_events")
          .update({ geolocation: payload })
          .eq("id", eventId);
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
