import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;
  try {
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    const admin = createAdminClient();

    if (typeof body.name === "string") updates.name = body.name.trim();
    if (typeof body.type === "string") {
      const valid = ["retail", "designer", "hospitality", "gallery", "realtor", "b2c"];
      if (valid.includes(body.type)) updates.type = body.type;
    }
    if (typeof body.contact_name === "string") updates.contact_name = body.contact_name.trim();
    if (typeof body.email === "string") updates.email = body.email.trim().toLowerCase();
    if (typeof body.phone === "string") updates.phone = body.phone.trim();
    if (typeof body.vertical === "string") updates.vertical = body.vertical;
    if (body.portal_features && typeof body.portal_features === "object" && !Array.isArray(body.portal_features)) {
      const { data: existingOrg } = await admin.from("organizations").select("portal_features").eq("id", id).single();
      const prev =
        existingOrg?.portal_features && typeof existingOrg.portal_features === "object" && !Array.isArray(existingOrg.portal_features)
          ? (existingOrg.portal_features as Record<string, unknown>)
          : {};
      updates.portal_features = { ...prev, ...(body.portal_features as Record<string, unknown>) };
    }
    if (body.invoice_due_days !== undefined) {
      const v = Number(body.invoice_due_days);
      if (v === 15 || v === 30) updates.invoice_due_days = v;
      else if (body.invoice_due_days === null) updates.invoice_due_days = null;
    }
    if (body.invoice_due_day_of_month !== undefined) {
      const v = Number(body.invoice_due_day_of_month);
      if (v === 15 || v === 30) updates.invoice_due_day_of_month = v;
      else if (body.invoice_due_day_of_month === null || body.invoice_due_day_of_month === "") updates.invoice_due_day_of_month = null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error } = await admin.from("organizations").update(updates).eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;
  try {
    const { id } = await params;
    const admin = createAdminClient();
    const { error } = await admin.from("organizations").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
