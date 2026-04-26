import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFeatureConfig } from "@/lib/platform-settings";
import { sendSMS } from "@/lib/sms/sendSMS";
import { buildETAMessage } from "@/lib/sms/etaMessages";
import {
  buildPublicDeliveryTrackUrl,
  buildPublicMoveTrackUrl,
} from "@/lib/notifications/public-track-url";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { jobId, jobType } = body;
    if (!jobId || !jobType || !["move", "delivery"].includes(jobType)) {
      return NextResponse.json({ error: "jobId and jobType required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const cfg = await getFeatureConfig(["sms_eta_enabled"]);
    const smsEnabled = cfg.sms_eta_enabled === "true";

    if (jobType === "move") {
      const { data: move } = await admin
        .from("moves")
        .select("id, move_code, client_name, client_phone")
        .eq("id", jobId)
        .maybeSingle();

      if (!move?.client_phone) {
        return NextResponse.json({ ok: false, skipped: "no_phone" });
      }

      const trackingLink = buildPublicMoveTrackUrl({
        id: move.id,
        move_code: (move as { move_code?: string | null }).move_code,
      });

      if (smsEnabled) {
        const msg = buildETAMessage("completed", {
          recipientName: move.client_name || "Customer",
          originAddress: "",
          destinationAddress: "",
          etaMinutes: 0,
          trackingLink,
        });
        const sms = await sendSMS(move.client_phone, msg);
        await admin.from("eta_sms_log").insert({
          move_id: move.id,
          recipient_phone: move.client_phone,
          recipient_name: move.client_name || "",
          message_type: "completed",
          message_body: msg,
          twilio_sid: sms.id || null,
          eta_minutes: null,
          crew_lat: null,
          crew_lng: null,
          destination_lat: null,
          destination_lng: null,
        });
      }

      return NextResponse.json({ ok: true });
    }

    const { data: delivery } = await admin
      .from("deliveries")
      .select(
        "id, delivery_number, end_customer_name, end_customer_phone, organization_id",
      )
      .eq("id", jobId)
      .maybeSingle();

    if (!delivery?.end_customer_phone) {
      return NextResponse.json({ ok: false, skipped: "no_phone" });
    }

    const { data: org } = await admin
      .from("organizations")
      .select("name, customer_notifications_enabled")
      .eq("id", delivery.organization_id)
      .maybeSingle();

    if (smsEnabled && org?.customer_notifications_enabled) {
      const trackingLink = buildPublicDeliveryTrackUrl({
        id: delivery.id,
        delivery_number: (delivery as { delivery_number?: string | null })
          .delivery_number,
      });
      const partnerName = org?.name || "";

      const msg = buildETAMessage("completed", {
        recipientName: delivery.end_customer_name || "Customer",
        originAddress: "",
        destinationAddress: "",
        etaMinutes: 0,
        trackingLink,
        partnerName,
      });
      const sms = await sendSMS(delivery.end_customer_phone, msg);
      await admin.from("eta_sms_log").insert({
        delivery_id: delivery.id,
        recipient_phone: delivery.end_customer_phone,
        recipient_name: delivery.end_customer_name || "",
        message_type: "completed",
        message_body: msg,
        twilio_sid: sms.id || null,
        eta_minutes: null,
        crew_lat: null,
        crew_lng: null,
        destination_lat: null,
        destination_lng: null,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Send completed error:", error);
    return NextResponse.json({ error: "Send completed failed" }, { status: 500 });
  }
}
