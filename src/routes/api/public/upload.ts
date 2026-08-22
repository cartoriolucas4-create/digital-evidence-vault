import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";

const MAX_BYTES = 15 * 1024 * 1024;

export const Route = createFileRoute("/api/public/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return new Response(JSON.stringify({ error: "invalid_form" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const eventId = String(form.get("eventId") ?? "");
        const caseId = String(form.get("caseId") ?? "");
        const facing = String(form.get("facing") ?? "") || null;
        const widthRaw = form.get("width");
        const heightRaw = form.get("height");
        const clientTs = form.get("clientTimestamp");
        const file = form.get("file");

        if (!eventId || !caseId || !(file instanceof File)) {
          return new Response(JSON.stringify({ error: "missing" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        if (!file.type.startsWith("image/")) {
          return new Response(JSON.stringify({ error: "invalid_mime" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (file.size > MAX_BYTES) {
          return new Response(JSON.stringify({ error: "too_large" }), {
            status: 413,
            headers: { "content-type": "application/json" },
          });
        }

        const buf = Buffer.from(await file.arrayBuffer());
        const sha256 = createHash("sha256").update(buf).digest("hex");
        const ext = file.type.split("/")[1]?.split("+")[0] ?? "bin";
        const path = `${caseId}/${eventId}/${sha256}.${ext}`;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const up = await supabaseAdmin.storage
          .from("evidence")
          .upload(path, buf, { contentType: file.type, upsert: false });
        if (up.error && !/already exists/i.test(up.error.message)) {
          return new Response(JSON.stringify({ error: up.error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }

        const { data, error } = await supabaseAdmin
          .from("evidence_files")
          .insert({
            event_id: eventId,
            case_id: caseId,
            kind: "camera_image",
            storage_path: path,
            mime_type: file.type,
            extension: ext,
            size_bytes: file.size,
            sha256,
            camera_facing: facing,
            width: widthRaw ? Number(widthRaw) : null,
            height: heightRaw ? Number(heightRaw) : null,
            client_timestamp: clientTs ? String(clientTs) : null,
          })
          .select("id")
          .single();
        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
        return Response.json({ ok: true, sha256, fileId: data.id });
      },
    },
  },
});
