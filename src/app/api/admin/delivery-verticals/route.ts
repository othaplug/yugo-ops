import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/check-role";
import { requireAdmin } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

const METHODS = new Set(["flat", "per_item", "per_unit", "hourly", "dimensional"]);

export async function GET() {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const db = createAdminClient();
  const { data, error } = await db
    .from("delivery_verticals")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message, verticals: [] }, { status: 200 });
  }

  return NextResponse.json({ verticals: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireOwner();
  if (authErr) return authErr;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code.trim().toLowerCase().replace(/\s+/g, "_") : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!code || !name) {
    return NextResponse.json({ error: "code and name are required" }, { status: 400 });
  }

  const pricing_method = typeof body.pricing_method === "string" ? body.pricing_method : "dimensional";
  if (!METHODS.has(pricing_method)) {
    return NextResponse.json({ error: "Invalid pricing_method" }, { status: 400 });
  }

  let default_config: Record<string, unknown> = {};
  if (body.default_config && typeof body.default_config === "object" && !Array.isArray(body.default_config)) {
    default_config = body.default_config as Record<string, unknown>;
  } else if (typeof body.default_config === "string") {
    try {
      default_config = JSON.parse(body.default_config) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "default_config must be valid JSON" }, { status: 400 });
    }
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("delivery_verticals")
    .insert({
      code,
      name,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      icon: typeof body.icon === "string" ? body.icon.trim() || null : null,
      base_rate: Number(body.base_rate) || 350,
      pricing_method,
      default_config,
      active: body.active !== false,
      sort_order: Number(body.sort_order) || 0,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAudit({
    userId: user?.id,
    userEmail: user?.email,
    action: "config_change",
    resourceType: "delivery_vertical",
    resourceId: code,
    details: { op: "create", name },
  });

  return NextResponse.json({ vertical: data });
}

export async function PATCH(req: NextRequest) {
  const { user, error: authErr } = await requireOwner();
  if (authErr) return authErr;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!id && !code) {
    return NextResponse.json({ error: "id or code required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string") updates.name = body.name.trim();
  if (typeof body.description === "string") updates.description = body.description.trim() || null;
  if (typeof body.icon === "string") updates.icon = body.icon.trim() || null;
  if (body.base_rate !== undefined) updates.base_rate = Number(body.base_rate) || 0;
  if (typeof body.pricing_method === "string" && METHODS.has(body.pricing_method)) {
    updates.pricing_method = body.pricing_method;
  }
  if (body.sort_order !== undefined) updates.sort_order = Number(body.sort_order) || 0;
  if (body.active !== undefined) updates.active = !!body.active;
  if (body.default_config !== undefined) {
    if (typeof body.default_config === "object" && !Array.isArray(body.default_config)) {
      updates.default_config = body.default_config;
    } else if (typeof body.default_config === "string") {
      try {
        updates.default_config = JSON.parse(body.default_config);
      } catch {
        return NextResponse.json({ error: "default_config must be valid JSON" }, { status: 400 });
      }
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const db = createAdminClient();
  let q = db.from("delivery_verticals").update(updates);
  q = id ? q.eq("id", id) : q.eq("code", code);
  const { data, error } = await q.select("*").maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: "Vertical not found" }, { status: 404 });
  }

  await logAudit({
    userId: user?.id,
    userEmail: user?.email,
    action: "config_change",
    resourceType: "delivery_vertical",
    resourceId: String(data.code),
    details: { op: "update", fields: Object.keys(updates) },
  });

  return NextResponse.json({ vertical: data });
}
