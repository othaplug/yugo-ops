import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/**
 * Server-durable quote-draft store (mirrors the operator's localStorage draft
 * so it survives a cleared cache and resumes on any device). Keyed by the SAME
 * uuid the client uses locally.
 *
 * GET  → this operator's draft metas (newest first)
 * POST → upsert one draft snapshot (body: { id, formType, title, path, snapshot })
 *
 * Every DB call is best-effort: if the quote_drafts table hasn't been created
 * yet (migration not applied), we return an empty/ok response so the wizard
 * silently falls back to its localStorage draft instead of erroring.
 */

const DRAFT_TTL_DAYS = 7;

export async function GET() {
  const { user, error } = await requireStaff();
  if (error) return error;
  const email = user!.email ?? "";

  const admin = createAdminClient();
  const { data, error: dbErr } = await admin
    .from("quote_drafts")
    .select("id, form_type, title, path, updated_at")
    .eq("operator_email", email)
    .order("updated_at", { ascending: false })
    .limit(50);

  if (dbErr) {
    // Table missing / transient — degrade to "no server drafts".
    return NextResponse.json({ drafts: [] });
  }

  const cutoff = Date.now() - DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000;
  const drafts = (data ?? [])
    .filter((d) => {
      const t = Date.parse(d.updated_at as string);
      return !Number.isFinite(t) || t >= cutoff;
    })
    .map((d) => ({
      id: d.id,
      formType: d.form_type,
      title: d.title,
      path: d.path,
      updatedAt: d.updated_at,
    }));

  return NextResponse.json({ drafts });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireStaff();
  if (error) return error;
  const email = user!.email ?? "";

  let body: {
    id?: string;
    formType?: string;
    title?: string;
    path?: string;
    snapshot?: Record<string, unknown>;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "Valid draft id required" }, { status: 400 });
  }
  if (!body.snapshot || typeof body.snapshot !== "object") {
    return NextResponse.json({ error: "snapshot required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const { error: dbErr } = await admin.from("quote_drafts").upsert(
    {
      id,
      operator_email: email,
      form_type: String(body.formType ?? "quote"),
      title: body.title ? String(body.title).slice(0, 200) : null,
      path: body.path ? String(body.path).slice(0, 500) : null,
      snapshot: body.snapshot,
      updated_at: nowIso,
    },
    { onConflict: "id" },
  );

  if (dbErr) {
    // Table missing / transient — the localStorage draft still protects the user.
    return NextResponse.json({ ok: false, persisted: false });
  }

  // Best-effort prune of this operator's stale drafts.
  const cutoffIso = new Date(
    Date.now() - DRAFT_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  await admin
    .from("quote_drafts")
    .delete()
    .eq("operator_email", email)
    .lt("updated_at", cutoffIso);

  return NextResponse.json({ ok: true, persisted: true });
}
