import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";
import { resolveVertical, isPropertyManagementDeliveryVertical } from "@/lib/partner-type";
import {
  clampToActiveDeliveryVerticalCode,
  mapOrgVerticalToDeliveryVerticalCode,
} from "@/lib/maps/vertical-config";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { id: organizationId } = await params;
  const db = createAdminClient();

  const [{ data: verticalsRows, error: vertErr }, orgRes, ratesRes] = await Promise.all([
    db.from("delivery_verticals").select("code, name").eq("active", true).order("sort_order"),
    db.from("organizations").select("vertical, type").eq("id", organizationId).maybeSingle(),
    db
      .from("partner_vertical_rates")
      .select("id, vertical_code, custom_rates, active")
      .eq("organization_id", organizationId)
      .order("vertical_code", { ascending: true }),
  ]);

  const orgErr = orgRes.error;

  if (vertErr || orgErr || ratesRes.error) {
    return NextResponse.json(
      { error: vertErr?.message || orgErr?.message || ratesRes.error?.message || "Lookup failed" },
      { status: 500 },
    );
  }

  const verticals = verticalsRows ?? [];
  const rates = (ratesRes.data ?? []) as {
    vertical_code: string;
    custom_rates?: Record<string, unknown>;
  }[];
  const org = orgRes.data as { vertical?: string | null; type?: string | null } | null;

  const codeOrder = verticals.map((v) => String(v.code ?? ""));
  const slug = resolveVertical(String(org?.vertical ?? org?.type ?? ""));
  const mapped = mapOrgVerticalToDeliveryVerticalCode(slug);
  const recommended_vertical_code = clampToActiveDeliveryVerticalCode(mapped, codeOrder);

  const portfolio_b2b_overrides_notice = isPropertyManagementDeliveryVertical(slug);

  return NextResponse.json({
    verticals,
    rates,
    recommended_vertical_code,
    portfolio_b2b_overrides_notice,
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
