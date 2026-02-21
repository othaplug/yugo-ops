import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { getPlatformToggles } from "@/lib/platform-settings";

/** GET: Return platform toggles (admin only). */
export async function GET() {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;
  try {
    const toggles = await getPlatformToggles();
    return NextResponse.json({
      crewTracking: toggles.crew_tracking,
      partnerPortal: toggles.partner_portal,
      autoInvoicing: toggles.auto_invoicing,
    });
  } catch (e) {
    console.error("[platform-settings] GET error:", e);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

/** PATCH: Update platform toggles (admin only). */
export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;
  try {
    const body = await req.json();
    const crew_tracking = typeof body.crewTracking === "boolean" ? body.crewTracking : undefined;
    const partner_portal = typeof body.partnerPortal === "boolean" ? body.partnerPortal : undefined;
    const auto_invoicing = typeof body.autoInvoicing === "boolean" ? body.autoInvoicing : undefined;
    if (crew_tracking === undefined && partner_portal === undefined && auto_invoicing === undefined) {
      return NextResponse.json({ error: "No valid toggles to update" }, { status: 400 });
    }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (crew_tracking !== undefined) updates.crew_tracking = crew_tracking;
    if (partner_portal !== undefined) updates.partner_portal = partner_portal;
    if (auto_invoicing !== undefined) updates.auto_invoicing = auto_invoicing;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("platform_settings")
      .update(updates)
      .eq("id", "default")
      .select("crew_tracking, partner_portal, auto_invoicing")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      crewTracking: data?.crew_tracking ?? true,
      partnerPortal: data?.partner_portal ?? false,
      autoInvoicing: data?.auto_invoicing ?? true,
    });
  } catch (e) {
    console.error("[platform-settings] PATCH error:", e);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
