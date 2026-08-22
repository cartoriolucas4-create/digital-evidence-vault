import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function serverPublicClient() {
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const getPublicCase = createServerFn({ method: "GET" })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const sb = serverPublicClient();
    const { data: row, error } = await sb
      .from("cases")
      .select("id, title, description, content, image_url, is_active")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row || !row.is_active) return null;
    return row;
  });

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

export const listCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("cases")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const upsertCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    title: string;
    description?: string | null;
    content?: string | null;
    image_url?: string | null;
    investigation_id?: string | null;
    campaign_id?: string | null;
    is_active?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    const row = {
      title: data.title,
      description: data.description ?? null,
      content: data.content ?? null,
      image_url: data.image_url ?? null,
      investigation_id: data.investigation_id ?? null,
      campaign_id: data.campaign_id ?? null,
      is_active: data.is_active ?? true,
      created_by: context.userId,
    };
    let out;
    if (data.id) {
      const r = await context.supabase.from("cases").update(row).eq("id", data.id).select("*").single();
      if (r.error) throw new Error(r.error.message);
      out = r.data;
    } else {
      const r = await context.supabase.from("cases").insert(row).select("*").single();
      if (r.error) throw new Error(r.error.message);
      out = r.data;
    }
    await context.supabase.from("audit_log").insert({
      user_id: context.userId,
      user_email: (context.claims as any)?.email ?? null,
      action: data.id ? "case.update" : "case.create",
      target_type: "case",
      target_id: out.id,
      details: { title: out.title },
    });
    return out;
  });

export const deleteCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const r = await context.supabase.from("cases").delete().eq("id", data.id);
    if (r.error) throw new Error(r.error.message);
    await context.supabase.from("audit_log").insert({
      user_id: context.userId,
      user_email: (context.claims as any)?.email ?? null,
      action: "case.delete",
      target_type: "case",
      target_id: data.id,
    });
    return { ok: true };
  });

export const listEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { caseId?: string | null }) => d)
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("access_events")
      .select("id, case_id, session_id, ip_v4, ip_v6, ip_source, user_agent, server_timestamp_utc, geolocation, browser")
      .order("server_timestamp_utc", { ascending: false })
      .limit(500);
    if (data.caseId) q = q.eq("case_id", data.caseId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getEventDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const ev = await context.supabase.from("access_events").select("*").eq("id", data.id).single();
    if (ev.error) throw new Error(ev.error.message);
    const files = await context.supabase.from("evidence_files").select("*").eq("event_id", data.id);
    if (files.error) throw new Error(files.error.message);
    const c = await context.supabase.from("cases").select("id, title, investigation_id, campaign_id").eq("id", ev.data.case_id).maybeSingle();
    const signed: Array<{ id: string; url: string | null }> = [];
    for (const f of files.data ?? []) {
      const s = await context.supabase.storage.from("evidence").createSignedUrl(f.storage_path, 300);
      signed.push({ id: f.id, url: s.data?.signedUrl ?? null });
    }
    await context.supabase.from("audit_log").insert({
      user_id: context.userId,
      user_email: (context.claims as any)?.email ?? null,
      action: "event.view",
      target_type: "event",
      target_id: data.id,
    });
    return { event: ev.data, files: files.data ?? [], case: c.data ?? null, signed };
  });

export const listAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const recordExport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { eventId: string; format: string }) => d)
  .handler(async ({ data, context }) => {
    await context.supabase.from("audit_log").insert({
      user_id: context.userId,
      user_email: (context.claims as any)?.email ?? null,
      action: "event.export",
      target_type: "event",
      target_id: data.eventId,
      details: { format: data.format },
    });
    return { ok: true };
  });
