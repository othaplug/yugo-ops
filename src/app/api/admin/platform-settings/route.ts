import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/check-role";
import { getPlatformToggles, getOfficeLocation } from "@/lib/platform-settings";
import { logActivity } from "@/lib/activity";

/** GET: Return platform toggles + office location (owner only). */
export async function GET() {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;
  try {
    const [toggles, office] = await Promise.all([getPlatformToggles(), getOfficeLocation()]);
    return NextResponse.json({
      crewTracking: toggles.crew_tracking,
      partnerPortal: toggles.partner_portal,
      autoInvoicing: toggles.auto_invoicing,
      office,
    });
  } catch (e) {
    console.error("[platform-settings] GET error:", e);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

/** PATCH: Update platform toggles (owner only). */
export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;
  try {
    const body = await req.json();
    const crew_tracking = typeof body.crewTracking === "boolean" ? body.crewTracking : undefined;
    const partner_portal = typeof body.partnerPortal === "boolean" ? body.partnerPortal : undefined;
    const auto_invoicing = typeof body.autoInvoicing === "boolean" ? body.autoInvoicing : undefined;
    const office = body.office as { lat?: number; lng?: number; address?: string; radiusM?: number } | undefined;

    const hasToggle = crew_tracking !== undefined || partner_portal !== undefined || auto_invoicing !== undefined;
    const hasOffice = office && (typeof office.lat === "number" || typeof office.address === "string");
    if (!hasToggle && !hasOffice) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (crew_tracking !== undefined) updates.crew_tracking = crew_tracking;
    if (partner_portal !== undefined) updates.partner_portal = partner_portal;
    if (auto_invoicing !== undefined) updates.auto_invoicing = auto_invoicing;
    if (office) {
      if (typeof office.lat === "number") updates.office_lat = office.lat;
      if (typeof office.lng === "number") updates.office_lng = office.lng;
      if (typeof office.address === "string") updates.office_address = office.address;
      if (typeof office.radiusM === "number") updates.office_radius_m = office.radiusM;
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("platform_settings")
      .update(updates)
      .eq("id", "default")
      .select("crew_tracking, partner_portal, auto_invoicing")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const changed: string[] = [];
    if (crew_tracking !== undefined) changed.push(`crew_tracking=${crew_tracking}`);
    if (partner_portal !== undefined) changed.push(`partner_portal=${partner_portal}`);
    if (auto_invoicing !== undefined) changed.push(`auto_invoicing=${auto_invoicing}`);
    if (hasOffice) changed.push("office_location");
    if (changed.length > 0) {
      logActivity({
        entity_type: "settings",
        entity_id: "platform",
        event_type: "settings_changed",
        description: `Platform settings updated: ${changed.join(", ")}`,
        icon: "pen",
      }).catch(() => {});
    }

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
