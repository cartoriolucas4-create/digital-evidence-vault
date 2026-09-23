import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push";
import { EXTERNAL_STUDY_REMINDER_MESSAGES } from "./messages.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const b64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

async function ensureVapidKeys() {
  const { data: config } = await admin
    .from("mcr_push_config")
    .select("id,public_key,private_key,cron_secret")
    .eq("id", true)
    .maybeSingle();

  if (!config) throw new Error("Push configuration not initialized.");

  if (config.public_key && config.private_key) {
    return config;
  }

  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  ) as CryptoKeyPair;

  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const publicKey = b64(new Uint8Array([
    4,
    ...Uint8Array.from(atob(publicJwk.x!.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - publicJwk.x!.length % 4) % 4)), c => c.charCodeAt(0)),
    ...Uint8Array.from(atob(publicJwk.y!.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - publicJwk.y!.length % 4) % 4)), c => c.charCodeAt(0))
  ]));
  const privateKey = privateJwk.d!;

  const { error } = await admin
    .from("mcr_push_config")
    .update({ public_key: publicKey, private_key: privateKey })
    .eq("id", true);

  if (error) throw error;
  return { ...config, public_key: publicKey, private_key: privateKey };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mcr-cron-secret",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
};

const getReminderSlot = (body: Record<string, unknown>) => {
  const slot = body.slot;
  return slot === "midday" || slot === "evening" ? slot : null;
};

const getReminderMessage = (slot: "midday" | "evening") => {
  const dayNumber = Math.floor(Date.now() / 86400000);
  const slotOffset = slot === "midday" ? 0 : 1;
  return EXTERNAL_STUDY_REMINDER_MESSAGES[(dayNumber * 2 + slotOffset) % EXTERNAL_STUDY_REMINDER_MESSAGES.length];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  try {
    const config = await ensureVapidKeys();

    if (req.method === "GET") {
      return new Response(JSON.stringify({ publicKey: config.public_key }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    if (req.headers.get("x-mcr-cron-secret") !== config.cron_secret) {
      return new Response("Unauthorized", { status: 401 });
    }

    let body: Record<string, unknown> = {};
    try {
      body = req.method === "POST" ? await req.json() : {};
    } catch {}

    const slot = getReminderSlot(body);
    if (!slot) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid reminder slot." }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
      });
    }

    webpush.setVapidDetails("mailto:admin@mcr.app", config.public_key!, config.private_key!);

    const { data: subscriptions, error } = await admin
      .from("mcr_push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .eq("enabled", true);

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
    }

    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
    const message = getReminderMessage(slot);
    let sent = 0, skipped = 0, removed = 0;

    for (const sub of subscriptions ?? []) {
      const { data: latest } = await admin
        .from("study_entries")
        .select("study_date,created_at")
        .eq("user_id", sub.user_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latest?.study_date === today) {
        skipped++;
        continue;
      }

      if (latest?.created_at && now.getTime() - new Date(latest.created_at).getTime() < 24 * 60 * 60 * 1000) {
        skipped++;
        continue;
      }

      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({
            title: message[0],
            body: message[1],
            tag: `mcr-study-reminder-${slot}`,
            url: "/digital-evidence-vault/"
          }),
          { TTL: 3600 }
        );
        sent++;
      } catch (pushError) {
        const status = (pushError as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) {
          await admin.from("mcr_push_subscriptions").delete().eq("id", sub.id);
          removed++;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, skipped, removed }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
