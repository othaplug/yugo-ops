import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getDeliveryDetailPath, isUuid } from "@/lib/move-code";
import { resolveHubSpotPipelineId } from "@/lib/hubspot/hubspot-pipeline";
import { resolveHubSpotStageInternalId } from "@/lib/hubspot/resolve-hubspot-stage-id";
import { autoCreateHubSpotDealForNewDelivery } from "@/lib/hubspot/auto-create-deal-for-delivery";
import {
  syncDealStage,
  deliveryStatusToHubspotTrigger,
} from "@/lib/hubspot/sync-deal-stage";

/**
 * Staff: create or link a HubSpot deal for a delivery that never got CRM sync (e.g. pre-fix bookings).
 */
export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id: rawId } = await ctx.params;
  const slug = decodeURIComponent((rawId || "").trim());
  if (!slug) {
    return NextResponse.json(
      { success: false, code: "BAD_REQUEST", message: "Delivery id or number is required" },
      { status: 400 },
    );
  }

  const sb = createAdminClient();
  const byUuid = isUuid(slug);
  const { data: delivery, error: dErr } = byUuid
    ? await sb.from("deliveries").select("*").eq("id", slug).single()
    : await sb.from("deliveries").select("*").ilike("delivery_number", slug).single();

  if (dErr || !delivery) {
    return NextResponse.json(
      { success: false, code: "NOT_FOUND", message: "Delivery not found" },
      { status: 404 },
    );
  }

  const existingHs =
    typeof delivery.hubspot_deal_id === "string"
      ? delivery.hubspot_deal_id.trim()
      : "";
  if (existingHs) {
    return NextResponse.json({ success: true, dealId: existingHs, alreadyLinked: true });
  }

  const st = String(delivery.status || "").toLowerCase();
  if (st === "draft") {
    return NextResponse.json(
      {
        success: false,
        code: "DRAFT",
        message: "Confirm or schedule the delivery before syncing to HubSpot.",
      },
      { status: 400 },
    );
  }

  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    return NextResponse.json(
      {
        success: false,
        code: "NO_TOKEN",
        message:
          "HubSpot token is not configured on the server. Add HUBSPOT_ACCESS_TOKEN to the deployment environment.",
      },
      { status: 503 },
    );
  }

  const pipelineId = await resolveHubSpotPipelineId(sb);
  if (!pipelineId) {
    return NextResponse.json(
      {
        success: false,
        code: "NO_PIPELINE",
        message:
          "Set the deals pipeline in Platform Settings under App, HubSpot (hubspot_pipeline_id).",
      },
      { status: 503 },
    );
  }

  const stageBooked = await resolveHubSpotStageInternalId(sb, "booked");
  if (!stageBooked) {
    return NextResponse.json(
      {
        success: false,
        code: "NO_STAGE",
        message:
          "Set the Booked stage in Platform Settings under App, HubSpot (hubspot_stage_booked or hubspot_stage_deposit_received).",
      },
      { status: 503 },
    );
  }

  const clientEmail = (
    (delivery.contact_email as string)?.trim() ||
    (delivery.customer_email as string)?.trim() ||
    (delivery.end_customer_email as string)?.trim() ||
    ""
  ).toLowerCase();

  if (!clientEmail) {
    return NextResponse.json(
      {
        success: false,
        code: "NO_EMAIL",
        message:
          "Add a contact, customer, or end customer email on the delivery, then try again.",
      },
      { status: 400 },
    );
  }

  const bookingType = String(delivery.booking_type || "").toLowerCase();
  const primaryContactLabel =
    bookingType === "one_off"
      ? String(delivery.contact_name || delivery.customer_name || "").trim()
      : String(delivery.customer_name || delivery.contact_name || "").trim();
  const nameParts =
    primaryContactLabel.length > 0
      ? primaryContactLabel.split(/\s+/)
      : ["Contact"];
  const firstName = nameParts[0]?.trim() || "Contact";
  const lastName = nameParts.slice(1).join(" ").trim();
  const baseUrl = getEmailBaseUrl();
  const path = getDeliveryDetailPath({
    delivery_number: delivery.delivery_number as string | undefined,
    id: delivery.id as string,
  });
  const deliveryAdminUrl = `${baseUrl}${path}`;

  let forceCreate = false;
  try {
    const body = (await req.json()) as { forceCreate?: boolean };
    forceCreate = body?.forceCreate === true;
  } catch {
    /* no body */
  }

  const created = await autoCreateHubSpotDealForNewDelivery({
    sb,
    delivery: {
      id: delivery.id as string,
      scheduled_date: delivery.scheduled_date as string | null,
      pickup_address: delivery.pickup_address as string | null,
      delivery_address: delivery.delivery_address as string | null,
      pickup_access: delivery.pickup_access as string | null,
      delivery_access: delivery.delivery_access as string | null,
      calculated_price:
        delivery.calculated_price != null ? Number(delivery.calculated_price) : null,
      quoted_price: delivery.quoted_price != null ? Number(delivery.quoted_price) : null,
      total_price: delivery.total_price != null ? Number(delivery.total_price) : null,
      booking_type: delivery.booking_type as string | null,
      vertical_code: delivery.vertical_code as string | null,
      business_name: delivery.business_name as string | null,
      client_name: delivery.client_name as string | null,
      contact_name: delivery.contact_name as string | null,
    },
    deliveryNumber: String(delivery.delivery_number || ""),
    clientEmail,
    firstName,
    lastName,
    clientPhone:
      ((delivery.contact_phone || delivery.customer_phone) as string | null)?.trim() ||
      null,
    deliveryAdminUrl,
    skipDuplicateCheck: forceCreate,
  });

  if (created?.status === "duplicate") {
    return NextResponse.json(
      {
        success: false,
        code: "DUPLICATE_OPEN_DEAL",
        message:
          "HubSpot already has an open deal for this contact. Retry with forceCreate: true if you still want a new deal.",
        existingDealId: created.existingDealId,
        existingDealName: created.existingDealName,
        existingDealStageId: created.existingDealStageId,
      },
      { status: 409 },
    );
  }

  if (!created || created.status !== "created" || !created.dealId) {
    return NextResponse.json(
      {
        success: false,
        code: "CREATE_FAILED",
        message:
          "HubSpot did not create a deal. Check server logs for the HubSpot response (properties, token, permissions).",
      },
      { status: 502 },
    );
  }

  await sb
    .from("deliveries")
    .update({ hubspot_deal_id: created.dealId })
    .eq("id", delivery.id as string);

  const trig = deliveryStatusToHubspotTrigger(delivery.status as string | null);
  if (trig) await syncDealStage(created.dealId, trig).catch(() => {});

  return NextResponse.json({ success: true, dealId: created.dealId });
}
