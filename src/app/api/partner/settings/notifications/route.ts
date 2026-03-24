import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

export async function POST(req: NextRequest) {
  const { primaryOrgId, error } = await requirePartner();
  if (error) return error;
  if (!primaryOrgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const body = await req.json();
  const admin = createAdminClient();

  // Save core notification settings — always supported
  await admin
    .from("organizations")
    .update({
      customer_notifications_enabled: !!body.customer_notifications_enabled,
      customer_notification_message: body.customer_notification_message || null,
    })
    .eq("id", primaryOrgId);

  // Attempt to save email preference flags (columns may not exist on all envs — fail silently)
  if (
    typeof body.email_delivery_updates === "boolean" ||
    typeof body.email_daily_summary === "boolean" ||
    typeof body.email_invoice_ready === "boolean"
  ) {
    try {
      await admin
        .from("organizations")
        .update({
          email_delivery_updates: body.email_delivery_updates ?? true,
          email_daily_summary: body.email_daily_summary ?? false,
          email_invoice_ready: body.email_invoice_ready ?? true,
        })
        .eq("id", primaryOrgId);
    } catch { /* column may not exist yet, preferences stored in client localStorage */ }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const { primaryOrgId, error } = await requirePartner();
  if (error) return error;
  if (!primaryOrgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("customer_notifications_enabled, customer_notification_message, email_delivery_updates, email_daily_summary, email_invoice_ready")
    .eq("id", primaryOrgId)
    .single();

  return NextResponse.json(data || {
    customer_notifications_enabled: false,
    customer_notification_message: null,
    email_delivery_updates: true,
    email_daily_summary: false,
    email_invoice_ready: true,
  });
}
