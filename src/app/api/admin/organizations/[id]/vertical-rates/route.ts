import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { id: organizationId } = await params;
  const db = createAdminClient();

  const [{ data: verticals }, { data: rates }] = await Promise.all([
    db.from("delivery_verticals").select("code, name").eq("active", true).order("sort_order"),
    db.from("partner_vertical_rates").select("id, vertical_code, custom_rates, active").eq("organization_id", organizationId),
  ]);

  return NextResponse.json({
    verticals: verticals ?? [],
    rates: rates ?? [],
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { id: organizationId } = await params;
  let body: { vertical_code?: string; custom_rates?: Record<string, unknown>; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const vertical_code = typeof body.vertical_code === "string" ? body.vertical_code.trim() : "";
  if (!vertical_code) {
    return NextResponse.json({ error: "vertical_code required" }, { status: 400 });
  }

  const custom_rates =
    body.custom_rates && typeof body.custom_rates === "object" && !Array.isArray(body.custom_rates)
      ? body.custom_rates
      : {};

  const db = createAdminClient();
  const { data, error } = await db
    .from("partner_vertical_rates")
    .upsert(
      {
        organization_id: organizationId,
        vertical_code,
        custom_rates,
        active: body.active !== false,
      },
      { onConflict: "organization_id,vertical_code" },
    )
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await logAudit({
    userId: user?.id,
    userEmail: user?.email,
    action: "config_change",
    resourceType: "partner_vertical_rates",
    resourceId: organizationId,
    details: { vertical_code },
  });

  return NextResponse.json({ rate: data });
}
