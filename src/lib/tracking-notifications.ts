import { createAdminClient } from "@/lib/supabase/admin";
import { getResend } from "@/lib/resend";
import { getEmailFrom, sendEmail } from "@/lib/email/send";
import {
  buildPublicDeliveryTrackUrl,
  buildPublicMoveTrackUrl,
  buildSmsTrackUrl,
} from "@/lib/notifications/public-track-url";
import { formatJobId } from "@/lib/move-code";
import {
  PREMIUM_TRACK_CTA_LABEL,
  PREMIUM_TRACK_DELIVERY_CTA_LABEL,
  statusUpdateEmailHtml,
} from "@/lib/email-templates";
import {
  isPartnerClassDelivery,
  sendPartnerDeliveryCheckpointSms,
  sendPartnerMoveCheckpointSms,
} from "@/lib/partner-job-comms";
import { deliveryContactEmail } from "@/lib/calendar/delivery-contact";
import { getFeatureConfig } from "@/lib/platform-settings";
import { sendClientTrackingCheckpointSms } from "@/lib/notifications/client-tracking-sms";
import type { TrackingStatus } from "@/lib/tracking-status-types";
import { getStatusLabel } from "@/lib/crew-tracking-status";

export type { TrackingStatus } from "@/lib/tracking-status-types";

const CONFIG: Record<
  string,
  { notifyClient: boolean; notifyAdmin: boolean; notifyPartner: boolean }
> = {
  en_route_to_pickup: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
  },
  arrived_at_pickup: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: false,
  },
  inventory_check: {
    notifyClient: false,
    notifyAdmin: false,
    notifyPartner: false,
  },
  loading: {
    notifyClient: false,
    notifyAdmin: false,
    notifyPartner: false,
  },
  wrapping: {
    notifyClient: false,
    notifyAdmin: false,
    notifyPartner: false,
  },
  en_route_to_destination: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
  },
  arrived_at_destination: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
  },
  unloading: {
    notifyClient: false,
    notifyAdmin: false,
    notifyPartner: false,
  },
  completed: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
  },
  en_route: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
  },
  arrived: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
  },
  delivering: {
    notifyClient: false,
    notifyAdmin: false,
    notifyPartner: false,
  },
  // ── Office-specific stages (Day 1 pack, Day 2 setup) ──
  // The client wants visibility on the "we've started your Day 1"
  // signal and again on the "we're wrapping Day 1 packing" milestone
  // — the two moments they'd otherwise be wondering. Loading /
  // unloading are covered by the residential-compatible Day 2 rows.
  initial_walkthrough: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: false,
  },
  it_documentation: {
    notifyClient: false, // fast-moving crew step, not a client signal
    notifyAdmin: false,
    notifyPartner: false,
  },
  packing_started: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: false,
  },
  packing_complete: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: false,
  },
  setup: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: false,
  },
  // ── Event stages (delivery leg: to venue + setup; return leg: teardown +
  // back to origin). Transit milestones notify the client; on-site work steps
  // (event_active, teardown) stay quiet like loading/unloading. ──
  en_route_venue: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
  },
  arrived_venue: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
  },
  event_active: {
    notifyClient: false,
    notifyAdmin: true,
    notifyPartner: false,
  },
  teardown: {
    notifyClient: false,
    notifyAdmin: true,
    notifyPartner: false,
  },
  en_route_return: {
    notifyClient: true,
    notifyAdmin: true,
    notifyPartner: true,
  },
};

function isEstateTier(t: string | null | undefined): boolean {
  return (
    String(t || "")
      .toLowerCase()
      .trim() === "estate"
  );
}

/** Email headline: move copy never references delivery; delivery copy never references a move. */
function headlineForTrackingCheckpoint(
  status: TrackingStatus,
  jobType: "move" | "delivery",
  estateMove = false,
  b2bPartnerJobStart = false,
  officeMove = false,
  eventMove = false,
  eventPhase: string | null = null,
): string {
  if (
    b2bPartnerJobStart &&
    (status === "en_route_to_pickup" || status === "en_route")
  ) {
    return jobType === "move"
      ? "Your crew has started the move. We will keep you updated at every step."
      : "Your crew has started the job. We will keep you updated at every step.";
  }
  if (jobType === "move" && eventMove) {
    // Event copy is phase-aware: the delivery leg drops off and sets up at the
    // venue; the return leg comes back after the event to pack up and return.
    const phase = String(eventPhase || "").toLowerCase().trim();
    if (phase === "return") {
      switch (status) {
        case "en_route_to_pickup":
        case "en_route_venue":
          return "Your crew is heading back to the venue to collect your items.";
        case "arrived_at_pickup":
        case "arrived_venue":
          return "Your crew has arrived at the venue to pack up.";
        case "teardown":
          return "Teardown is underway at the venue.";
        case "en_route_return":
        case "en_route_to_destination":
          return "Your items are on the way back.";
        case "completed":
          return "Everything is back and your event service is complete. Thank you for choosing Yugo.";
        default:
          return "A status update on your event.";
      }
    }
    // Delivery leg (default).
    switch (status) {
      case "en_route_to_pickup":
        return "Your crew is on the way to collect your items for the event.";
      case "arrived_at_pickup":
        return "Your crew has arrived to load your items.";
      case "en_route_venue":
      case "en_route_to_destination":
        return "Your items are on the way to the venue.";
      case "arrived_venue":
      case "arrived_at_destination":
        return "Your crew has arrived at the venue and is setting up.";
      case "completed":
        return "Your delivery to the venue is complete. We will return to collect everything after your event.";
      default:
        return "A status update on your event.";
    }
  }
  if (jobType === "move" && officeMove) {
    // Office-specific stage transition copy.
    switch (status) {
      case "initial_walkthrough":
        return "Your project manager is on-site starting the Day 1 walkthrough.";
      case "packing_started":
        return "Packing has started at your office. Your team can leave when ready.";
      case "packing_complete":
        return "Day 1 is complete — everything is packed and staged for tomorrow's move.";
      case "en_route_to_pickup":
        return "Day 2: your relocation crew is on the way to load the truck.";
      case "arrived_at_pickup":
        return "Your crew has arrived to load. We're on schedule.";
      case "en_route_to_destination":
        return "Everything is loaded. Your crew is now heading to the new office.";
      case "arrived_at_destination":
        return "Your crew has arrived at the new office and is ready to unload.";
      case "setup":
        return "Furniture and IT are being placed per your floor plan. Almost home.";
      case "completed":
        return "Relocation complete. Thank you for choosing Yugo.";
      default:
        break;
    }
  }
  if (jobType === "move") {
    if (estateMove) {
      switch (status) {
        case "en_route_to_pickup":
          return "Your Estate crew is on the way. We will keep you informed at every step.";
        case "arrived_at_pickup":
          return "Your crew has arrived and is ready to begin your Estate move.";
        case "en_route_to_destination":
          return "Everything is loaded. Your crew is now heading to your new home.";
        case "arrived_at_destination":
          return "Your crew has arrived and is ready to unload.";
        case "completed":
          return "Move complete. It was our privilege today.";
        case "en_route":
          return "Your Estate crew is on the way. We will notify you when they arrive.";
        case "arrived":
          return "Your crew has arrived at your address.";
        default:
          break;
      }
    }
    switch (status) {
      case "en_route_to_pickup":
        return "Your crew is on the way. We will keep you updated as your move day unfolds.";
      case "arrived_at_pickup":
        return "Your crew has arrived and is ready to begin. You are in good hands.";
      case "en_route_to_destination":
        return "Everything is loaded and your crew is now heading to your new home.";
      case "arrived_at_destination":
        return "Your crew has arrived and is ready to unload. You are almost there.";
      case "completed":
        return "Your move is complete. It was a privilege to take care of you today.";
      case "en_route":
        return "Your crew is on the way. We will notify you when they arrive.";
      case "arrived":
        return "Your crew has arrived at your address.";
      default:
        return "A status update on your move";
    }
  }
  switch (status) {
    case "en_route_to_pickup":
      return "Your crew is on the way to collect your delivery.";
    case "en_route":
      return "Your delivery is underway. We will notify you when your crew arrives.";
    case "arrived_at_pickup":
      return "Your crew has arrived and is ready to load your items for delivery.";
    case "en_route_to_destination":
      return "Your delivery is on its way to you.";
    case "arrived_at_destination":
      return "Your crew has arrived. Your delivery will be placed shortly.";
    case "completed":
      return "Your delivery is complete. Thank you for choosing Yugo.";
    case "arrived":
      return "Your crew has arrived with your delivery.";
    default:
      return "A status update on your delivery";
  }
}

function bodyForTrackingCheckpoint(
  status: TrackingStatus,
  jobType: "move" | "delivery",
  estateMove: boolean,
  b2bPartnerJobStart: boolean,
): string {
  if (
    b2bPartnerJobStart &&
    (status === "en_route_to_pickup" || status === "en_route")
  ) {
    return jobType === "move"
      ? "Your move is underway. Track live below, and we will notify you as each milestone is reached."
      : "Your job is underway. Track live below, and we will notify you as each milestone is reached.";
  }
  if (status === "completed") {
    return jobType === "delivery"
      ? "It was a pleasure taking care of you today. Thank you for choosing Yugo."
      : estateMove
        ? "It was a pleasure caring for your home today. Your documents and receipt remain available in your portal."
        : "It was a pleasure taking care of you today. Your documents and receipt are available in your portal.";
  }
  return jobType === "delivery"
    ? "Your crew has provided a live update. Track your delivery in real time using the link below."
    : estateMove
      ? "Your crew has shared a live update. Follow every step on your Estate tracker below."
      : "Your crew has provided a live update. Track your move in real time using the link below.";
}

export async function notifyOnCheckpoint(
  status: TrackingStatus,
  jobId: string,
  jobType: "move" | "delivery",
  teamName: string,
  jobName: string,
  fromAddress?: string,
  toAddress?: string,
): Promise<void> {
  const cfg = CONFIG[status] || {
    notifyClient: false,
    notifyAdmin: false,
    notifyPartner: false,
  };
  const admin = createAdminClient();

  const adminMessage =
    status === "completed"
      ? `${teamName} completed ${jobName}`
      : status === "en_route_to_pickup" || status === "en_route"
        ? `${teamName} started en route to pickup for ${jobName}`
        : status === "arrived_at_pickup"
          ? `${teamName} arrived at pickup ${fromAddress || "-"}`
          : status === "en_route_to_destination"
            ? `${teamName} en route to destination ${toAddress || "-"}`
            : status === "arrived_at_destination" || status === "arrived"
              ? `${teamName} arrived at ${toAddress || "-"}`
              : `${teamName} — ${getStatusLabel(status)}`;

  if (cfg.notifyAdmin) {
    try {
      const entityId =
        jobType === "move"
          ? (
              await admin
                .from("moves")
                .select("move_code")
                .eq("id", jobId)
                .single()
            ).data?.move_code || jobId
          : (
              await admin
                .from("deliveries")
                .select("delivery_number")
                .eq("id", jobId)
                .single()
            ).data?.delivery_number || jobId;
      await admin.from("status_events").insert({
        entity_type: jobType,
        entity_id: entityId,
        event_type: "tracking",
        description: adminMessage,
        icon: "truck",
      });
    } catch {}
  }

  if (!cfg.notifyClient && !cfg.notifyPartner) return;

  let clientEmail: string | null = null;
  let partnerEmail: string | null = null;
  let trackUrl: string | undefined;
  let smsTrackUrl: string | undefined;
  let moveCode: string | undefined;
  let moveFromAddress: string | undefined;
  let moveToAddress: string | undefined;
  let moveClientName: string | undefined;
  let deliveryClientName: string | undefined;

  let estateMove = false;
  let officeMove = false;
  let officeProjectManagerName: string | null = null;
  let eventMove = false;
  let eventPhase: string | null = null;
  let movePartnerEligible = false;
  let moveRowForSms: {
    id: string;
    organization_id?: string | null;
    client_phone?: string | null;
    /** Forwarded so sendPartnerMoveCheckpointSms can short-circuit PM
     *  moves without a second DB hit. */
    is_pm_move?: boolean | null;
  } | null = null;
  let deliveryRowForSms: {
    id: string;
    delivery_number: string;
    tracking_token?: string | null;
    recipient_tracking_token?: string | null;
    organization_id?: string | null;
    booking_type?: string | null;
    category?: string | null;
    contact_phone?: string | null;
    customer_phone?: string | null;
    end_customer_phone?: string | null;
    /** Site / recipient phone on B2B multi-stop (preferred over billing customer_phone for SMS). */
    end_client_phone?: string | null;
  } | null = null;

  if (jobType === "move") {
    const { data: move } = await admin
      .from("moves")
      .select(
        "id, client_email, move_code, from_address, to_address, client_name, tier_selected, organization_id, client_phone, is_pm_move, service_type, event_phase, quote_id",
      )
      .eq("id", jobId)
      .single();
    if (move) {
      moveRowForSms = {
        id: move.id,
        organization_id: (move as { organization_id?: string | null })
          .organization_id,
        client_phone: (move as { client_phone?: string | null }).client_phone,
        is_pm_move: (move as { is_pm_move?: boolean | null }).is_pm_move,
      };
      estateMove = isEstateTier(
        (move as { tier_selected?: string | null }).tier_selected,
      );
      // Office moves get office-specific transition copy (project
      // manager framing, "Day 1 walkthrough", "Day 2 en route" etc.).
      officeMove =
        String(
          (move as { service_type?: string | null }).service_type ?? "",
        ) === "office_move";
      // Office checkpoint SMS names the on-site Project Manager (distinct
      // from the coordinator). PM lives in the originating quote's
      // factors_applied.project_manager_name.
      if (officeMove) {
        const oqid = (move as { quote_id?: string | null }).quote_id;
        if (oqid) {
          const { data: oq } = await admin
            .from("quotes")
            .select("factors_applied")
            .eq("id", oqid)
            .maybeSingle();
          const fa = (oq?.factors_applied ?? {}) as Record<string, unknown>;
          const pmn = fa.project_manager_name;
          if (typeof pmn === "string" && pmn.trim()) {
            officeProjectManagerName = pmn.trim();
          }
        }
      }
      eventMove =
        String(
          (move as { service_type?: string | null }).service_type ?? "",
        ) === "event";
      eventPhase =
        (move as { event_phase?: string | null }).event_phase ?? null;
      clientEmail = move.client_email || null;
      const orgId = (move as { organization_id?: string | null })
        .organization_id;
      if (orgId) {
        const { data: org } = await admin
          .from("organizations")
          .select("email, type")
          .eq("id", orgId)
          .maybeSingle();
        if (org && org.type !== "b2c") {
          movePartnerEligible = true;
          partnerEmail = (org.email || "").trim() || null;
        }
      }
      trackUrl = buildPublicMoveTrackUrl({
        id: move.id,
        move_code: (move as { move_code?: string | null }).move_code,
      });
      moveCode = move.move_code || move.id;
      smsTrackUrl = move.move_code ? buildSmsTrackUrl(move.move_code) : trackUrl;
      moveFromAddress = move.from_address || undefined;
      moveToAddress = move.to_address || undefined;
      moveClientName = move.client_name || undefined;
    }
  } else {
    const { data: delivery } = await admin
      .from("deliveries")
      .select(
        "id, delivery_number, client_name, customer_name, customer_email, end_customer_email, contact_email, category, organization_id, booking_type, contact_phone, customer_phone, end_customer_phone, end_client_phone, tracking_token, recipient_tracking_token",
      )
      .eq("id", jobId)
      .single();
    if (delivery) {
      deliveryRowForSms = {
        id: delivery.id,
        delivery_number: delivery.delivery_number,
        tracking_token: (delivery as { tracking_token?: string | null })
          .tracking_token,
        recipient_tracking_token: (
          delivery as { recipient_tracking_token?: string | null }
        ).recipient_tracking_token,
        organization_id: (delivery as { organization_id?: string | null })
          .organization_id,
        booking_type: (delivery as { booking_type?: string | null })
          .booking_type,
        category: (delivery as { category?: string | null }).category,
        contact_phone: (delivery as { contact_phone?: string | null })
          .contact_phone,
        customer_phone: (delivery as { customer_phone?: string | null })
          .customer_phone,
        end_customer_phone: (delivery as { end_customer_phone?: string | null })
          .end_customer_phone,
        end_client_phone: (delivery as { end_client_phone?: string | null })
          .end_client_phone,
      };
      clientEmail = deliveryContactEmail(
        delivery as Parameters<typeof deliveryContactEmail>[0],
      );
      if (delivery.organization_id) {
        const { data: org } = await admin
          .from("organizations")
          .select("email")
          .eq("id", delivery.organization_id)
          .maybeSingle();
        partnerEmail = (org?.email || "").trim() || null;
      } else if (
        String(
          (delivery as { booking_type?: string | null }).booking_type || "",
        ) === "one_off"
      ) {
        partnerEmail =
          (
            (delivery as { contact_email?: string | null }).contact_email || ""
          ).trim() || null;
      } else if (delivery.client_name) {
        const { data: org } = await admin
          .from("organizations")
          .select("email")
          .eq("name", delivery.client_name)
          .limit(1)
          .maybeSingle();
        partnerEmail = (org?.email || "").trim() || null;
      } else {
        partnerEmail = null;
      }
      trackUrl = buildPublicDeliveryTrackUrl({
        id: delivery.id,
        delivery_number: delivery.delivery_number,
      });
      moveCode = delivery.delivery_number;
      smsTrackUrl = delivery.delivery_number ? buildSmsTrackUrl(delivery.delivery_number) : trackUrl;
      deliveryClientName = (
        (delivery as { customer_name?: string | null }).customer_name ||
        delivery.client_name ||
        ""
      )
        .trim() || undefined;
    }
  }

  const isJobStart = status === "en_route_to_pickup" || status === "en_route";
  const b2bPartnerJobStart =
    isJobStart &&
    ((jobType === "delivery" &&
      deliveryRowForSms &&
      isPartnerClassDelivery(deliveryRowForSms)) ||
      (jobType === "move" && movePartnerEligible));

  const featureCfg = await getFeatureConfig(["sms_eta_enabled"]);
  const smsEtaEnabled = featureCfg.sms_eta_enabled === "true";
  const isPartnerDeliveryStart =
    jobType === "delivery" &&
    isJobStart &&
    !!deliveryRowForSms &&
    isPartnerClassDelivery(deliveryRowForSms);
  const isOrgB2bMoveStart =
    jobType === "move" && isJobStart && movePartnerEligible;

  let partnerSmsNotifyClient = cfg.notifyClient;
  if (smsEtaEnabled) {
    if (isPartnerDeliveryStart) {
      let etaWouldSendToRecipient = true;
      if (deliveryRowForSms?.organization_id) {
        const { data: orgForEta } = await admin
          .from("organizations")
          .select("customer_notifications_enabled")
          .eq("id", deliveryRowForSms.organization_id)
          .maybeSingle();
        etaWouldSendToRecipient = !!orgForEta?.customer_notifications_enabled;
      }
      if (etaWouldSendToRecipient) partnerSmsNotifyClient = false;
    }
    if (isOrgB2bMoveStart) partnerSmsNotifyClient = false;
  }

  const resend = process.env.RESEND_API_KEY ? getResend() : null;

  const subject =
    status === "completed"
      ? jobType === "delivery"
        ? `Your delivery is complete | ${formatJobId(moveCode || jobId, jobType)}`
        : estateMove
          ? `Your Estate move is complete | ${formatJobId(moveCode || jobId, jobType)}`
          : `Your move is complete | ${formatJobId(moveCode || jobId, jobType)}`
      : estateMove && jobType === "move"
        ? `Your Estate move update | ${formatJobId(moveCode || jobId, jobType)}`
        : `Your crew update | ${formatJobId(moveCode || jobId, jobType)}`;

  const headline = headlineForTrackingCheckpoint(
    status,
    jobType,
    estateMove && jobType === "move",
    b2bPartnerJobStart,
    officeMove && jobType === "move",
    eventMove && jobType === "move",
    eventPhase,
  );
  const body = bodyForTrackingCheckpoint(
    status,
    jobType,
    estateMove && jobType === "move",
    b2bPartnerJobStart,
  );
  const liveEyebrow = b2bPartnerJobStart ? "Job started" : "Live update";
  const htmlPremium = statusUpdateEmailHtml({
    headline,
    body,
    ctaUrl: trackUrl,
    ctaLabel: trackUrl
      ? jobType === "delivery"
        ? PREMIUM_TRACK_DELIVERY_CTA_LABEL
        : PREMIUM_TRACK_CTA_LABEL
      : undefined,
    includeFooter: false,
    eyebrow: status === "completed" ? "Complete" : liveEyebrow,
    tone: "premium",
  });
  const htmlEstate = statusUpdateEmailHtml({
    headline,
    body,
    ctaUrl: trackUrl,
    ctaLabel: trackUrl
      ? jobType === "delivery"
        ? PREMIUM_TRACK_DELIVERY_CTA_LABEL
        : PREMIUM_TRACK_CTA_LABEL
      : undefined,
    includeFooter: false,
    eyebrow: status === "completed" ? "Estate complete" : liveEyebrow,
    tone: "estate",
  });

  const toSend: string[] = [];
  if (cfg.notifyClient && clientEmail) toSend.push(clientEmail);
  if (
    cfg.notifyPartner &&
    partnerEmail &&
    !toSend.some((e) => e.toLowerCase() === partnerEmail!.toLowerCase())
  ) {
    toSend.push(partnerEmail);
  }

  if (resend && toSend.length > 0) {
    // For move completion, send full "move complete" email (with portal/documents link) to client
    if (
      status === "completed" &&
      jobType === "move" &&
      clientEmail &&
      trackUrl
    ) {
      try {
        await sendEmail({
          to: clientEmail,
          subject: `Your move is complete | ${formatJobId(moveCode || jobId, jobType)}`,
          template: "move-complete",
          data: {
            clientName: moveClientName ?? "",
            moveCode: moveCode || jobId,
            fromAddress: moveFromAddress ?? "",
            toAddress: moveToAddress ?? "",
            completedDate: new Date().toISOString(),
            trackingUrl: trackUrl,
          },
        });
      } catch {}
    }

    // Generic status email: for moves we already sent move-complete to client, so only send to partner if any
    const toSendGeneric =
      status === "completed" && jobType === "move" && clientEmail
        ? toSend.filter((e) => e !== clientEmail)
        : toSend;

    const emailFrom = await getEmailFrom();
    for (const to of toSendGeneric) {
      try {
        const useEstateSkin =
          estateMove && jobType === "move" && to === clientEmail;
        await resend.emails.send({
          from: emailFrom,
          to,
          subject,
          html: useEstateSkin ? htmlEstate : htmlPremium,
          headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
        });
      } catch {}
    }
  }

  const phoneOk = (raw: string | null | undefined) =>
    (raw || "").replace(/\D/g, "").length >= 10;

  const partnerHandlesClientSms =
    (jobType === "delivery" &&
      deliveryRowForSms &&
      isPartnerClassDelivery(deliveryRowForSms) &&
      partnerSmsNotifyClient &&
      phoneOk(
        deliveryRowForSms.end_client_phone ||
          deliveryRowForSms.end_customer_phone ||
          deliveryRowForSms.customer_phone,
      )) ||
    (jobType === "move" &&
      moveRowForSms &&
      movePartnerEligible &&
      !!moveRowForSms.organization_id &&
      partnerSmsNotifyClient &&
      phoneOk(moveRowForSms.client_phone));

  if (cfg.notifyClient && !partnerHandlesClientSms) {
    const clientPhone =
      jobType === "move"
        ? moveRowForSms?.client_phone
        : deliveryRowForSms
          ? (
              deliveryRowForSms.end_client_phone ||
              deliveryRowForSms.end_customer_phone ||
              deliveryRowForSms.customer_phone ||
              deliveryRowForSms.contact_phone ||
              ""
            )
              .trim() || null
          : null;
    if (phoneOk(clientPhone)) {
      sendClientTrackingCheckpointSms({
        status,
        jobType,
        phone: clientPhone,
        clientName:
          jobType === "move"
            ? moveClientName
            : deliveryClientName ?? undefined,
        trackUrl: smsTrackUrl ?? trackUrl,
        estateMove: estateMove && jobType === "move",
        eventMove: eventMove && jobType === "move",
        eventPhase,
        officeMove: officeMove && jobType === "move",
        projectManagerName: officeProjectManagerName,
        jobUuid: jobId,
      }).catch(() => {});
    }
  }

  if (
    jobType === "delivery" &&
    deliveryRowForSms &&
    isPartnerClassDelivery(deliveryRowForSms)
  ) {
    sendPartnerDeliveryCheckpointSms({
      row: deliveryRowForSms,
      status,
      jobType: "delivery",
      teamName,
      notifyPartner: cfg.notifyPartner,
      notifyClient: partnerSmsNotifyClient,
    }).catch(() => {});
  } else if (jobType === "move" && moveRowForSms) {
    sendPartnerMoveCheckpointSms({
      row: moveRowForSms,
      status,
      teamName,
      notifyPartner: cfg.notifyPartner,
      notifyClient: partnerSmsNotifyClient,
    }).catch(() => {});
  }
}
