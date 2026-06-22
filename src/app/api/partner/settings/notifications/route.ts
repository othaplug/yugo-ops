import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";

export async function POST(req: NextRequest) {
  const { primaryOrgId, error } = await requirePartner();
  if (error) return error;
  if (!primaryOrgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const body = await req.json();
  const admin = createAdminClient();

  // Save core notification settings. The email_delivery_updates /
  // email_daily_summary / email_invoice_ready columns were never migrated,
  // so those toggles are accepted in the request body but only round-trip
  // through client localStorage — see GET below for the default reply.
  await admin
    .from("organizations")
    .update({
      customer_notifications_enabled: !!body.customer_notifications_enabled,
      customer_notification_message: body.customer_notification_message || null,
    })
    .eq("id", primaryOrgId);

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const { primaryOrgId, error } = await requirePartner();
  if (error) return error;
  if (!primaryOrgId) return NextResponse.json({ error: "No org" }, { status: 403 });

  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("customer_notifications_enabled, customer_notification_message")
    .eq("id", primaryOrgId)
    .single();

  return NextResponse.json({
    customer_notifications_enabled: data?.customer_notifications_enabled ?? false,
    customer_notification_message: data?.customer_notification_message ?? null,
    email_delivery_updates: true,
    email_daily_summary: false,
    email_invoice_ready: true,
  });
}
