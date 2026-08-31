import type { TrackingStatus } from "@/lib/tracking-status-types";
import { sendSMS } from "@/lib/sms/sendSMS";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  finalizeStageNotification,
  reserveStageNotification,
} from "@/lib/notifications/stage-notification";

// Note: SMS-provider failure alerting moved into sendSMS itself so EVERY
// caller is covered (partner/crew/bin/lead/quote-photo/supplies/etc.), not
// just client tracking. See @/lib/sms/sendSMS.

function digitsOnly(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

function firstName(clientName: string | null | undefined): string {
  const s = (clientName || "").trim().split(/\s+/)[0];
  return s || "there";
}

/**
 * Greeting rule: lead with "Hi Name," only on the opening ping (crew
 * dispatched) and the closing sign-off (completed). Every middle stage
 * skips the greeting so the same customer does not see "Hi Grant" 4×
 * across a single service window.
 */
function greetLead(status: TrackingStatus, name: string): string {
  const opens = status === "en_route_to_pickup" || status === "en_route";
  const closes = status === "completed";
  return opens || closes ? `Hi ${name},\n\n` : "";
}

function clientSmsBody(
  status: TrackingStatus,
  jobType: "move" | "delivery",
  clientName: string | null | undefined,
  trackUrl: string | undefined,
  estateMove: boolean,
  eventMove = false,
  eventPhase: string | null = null,
  officeMove = false,
  projectManagerName: string | null = null,
): string {
  const name = firstName(clientName);
  const linkNoun = eventMove ? "event" : officeMove ? "relocation" : jobType;
  const link = trackUrl ? `\n\nTrack your ${linkNoun}: ${trackUrl}` : "";
  const g = greetLead(status, name);

  // Office relocations: 12-step office flow across pack day + move day.
  if (jobType === "move" && officeMove) {
    const pm = (projectManagerName || "").trim();
    const pmLead = pm ? `${pm} and the crew` : "Your crew";
    switch (status) {
      case "initial_walkthrough":
        return `${g}${pmLead} are on site and starting the walkthrough of your office.${link}`;
      case "it_documentation":
        return `We are documenting and prepping your IT and workstations before anything is packed.${link}`;
      case "packing_started":
        return `Packing has started at your office. Your team can head out whenever they are ready.${link}`;
      case "packing_complete":
        return `Everything is packed and labelled for tomorrow's move. Day one is complete.${link}`;
      case "en_route_to_pickup":
      case "en_route":
        return `${g}${pmLead} are on the way to your office to load.${link}`;
      case "arrived_at_pickup":
      case "arrived":
        return `Your crew has arrived to load. On schedule.${link}`;
      case "loading":
        return `Loading is underway at your current office.${link}`;
      case "en_route_to_destination":
        return `Everything is loaded and on the way to your new office.${link}`;
      case "arrived_at_destination":
        return `Your crew has arrived at the new office and is ready to unload.${link}`;
      case "unloading":
        return `Unloading is underway at your new office.${link}`;
      case "setup":
        return `Furniture and IT are being placed to your floor plan. Almost there.${link}`;
      case "completed":
        return `${g}Your office relocation is complete. It was a pleasure handling this for your team.\n\nWarm regards, Yugo`;
      default:
        return `A quick update on your office relocation from Yugo.${link}`;
    }
  }

  // Events (delivery leg + return leg)
  if (jobType === "move" && eventMove) {
    const phase = String(eventPhase || "").toLowerCase().trim();
    if (phase === "return") {
      switch (status) {
        case "en_route_to_pickup":
        case "en_route_venue":
        case "en_route":
          return `${g}Your crew is heading back to the venue to collect your items.${link}`;
        case "arrived_at_pickup":
        case "arrived_venue":
        case "arrived":
          return `Your crew has arrived at the venue to pack up.`;
        case "teardown":
          return `Teardown is underway at the venue.${link}`;
        case "en_route_return":
        case "en_route_to_destination":
          return `Your items are on the way back.${link}`;
        case "completed":
          return `${g}Everything is back and your event service is complete. Thank you for trusting Yugo.\n\nWarm regards, Yugo`;
        default:
          return `A quick update on your event from Yugo.${link}`;
      }
    }
    switch (status) {
      case "en_route_to_pickup":
      case "en_route":
        return `${g}Your crew is on the way to collect your items for the event.${link}`;
      case "arrived_at_pickup":
        return `Your crew has arrived to load your items.`;
      case "en_route_venue":
      case "en_route_to_destination":
        return `Your items are on the way to the venue.${link}`;
      case "arrived_venue":
      case "arrived_at_destination":
        return `Your crew has arrived at the venue and is setting up.`;
      case "completed":
        return `${g}Your delivery to the venue is complete. We will return to collect everything after your event.${link}`;
      default:
        return `A quick update on your event from Yugo.${link}`;
    }
  }

  if (jobType === "move") {
    if (estateMove) {
      switch (status) {
        case "en_route_to_pickup":
        case "en_route":
          return `${g}Your Estate crew is on the way. We will text you at each milestone.${link}`;
        case "arrived_at_pickup":
          return `Your crew has arrived and is ready to begin your Estate move.`;
        case "inventory_check":
        case "loading":
        case "wrapping":
          return `Your crew is on site and taking care of your belongings.${link}`;
        case "en_route_to_destination":
          return `Your belongings are on the way to your new home.${link}`;
        case "arrived_at_destination":
          return `Your crew has arrived at your new home and is ready to unload.`;
        case "completed":
          return `${g}Your Estate move is complete. It was a true privilege caring for you today.\n\nWarm regards, Yugo`;
        case "arrived":
          return `Your crew has arrived.${link}`;
        default:
          return `A quick update on your Estate move.${link}`;
      }
    }

    switch (status) {
      case "en_route_to_pickup":
      case "en_route":
        return `${g}Your Yugo crew is on the way. We will text you at each stage.${link}`;
      case "arrived_at_pickup":
        return `Your crew has arrived and is ready to begin.`;
      case "inventory_check":
      case "loading":
      case "wrapping":
        return `Your crew is on site and taking good care of your belongings.${link}`;
      case "en_route_to_destination":
        return `Your belongings are on the way to your new home.${link}`;
      case "arrived_at_destination":
        return `Your crew has arrived at your new home and is ready to unload.`;
      case "completed":
        return `${g}Your move is complete. It was a pleasure taking care of you today.\n\nWarm regards, Yugo`;
      case "arrived":
        return `Your crew has arrived.${link}`;
      default:
        return `A quick update from Yugo.${link}`;
    }
  }

  // Deliveries
  switch (status) {
    case "en_route_to_pickup":
    case "en_route":
      return `${g}Your Yugo crew is on the way to pick up your delivery. We will text you again once we are on the road to you.${link}`;
    case "arrived_at_pickup":
      return `Your crew has reached the pickup location and is loading your order.`;
    case "en_route_to_destination":
      return `Your delivery is on the way to you.${link}`;
    case "arrived_at_destination":
    case "arrived":
      return `Your crew has arrived with your delivery.`;
    case "completed":
      return `${g}Your delivery is complete. Thanks for choosing Yugo.`;
    default:
      return `A quick update on your delivery from Yugo.${link}`;
  }
}

/** Sends a transactional SMS to the end client when email also goes out. Fire-and-forget logging. */
export async function sendClientTrackingCheckpointSms(opts: {
  status: TrackingStatus;
  jobType: "move" | "delivery";
  phone: string | null | undefined;
  clientName: string | null | undefined;
  trackUrl: string | undefined;
  estateMove: boolean;
  eventMove?: boolean;
  eventPhase?: string | null;
  officeMove?: boolean;
  projectManagerName?: string | null;
  jobUuid: string;
}): Promise<void> {
  const raw = (opts.phone || "").trim();
  if (digitsOnly(raw).length < 10) return;

  const body = clientSmsBody(
    opts.status,
    opts.jobType,
    opts.clientName,
    opts.trackUrl,
    opts.estateMove,
    opts.eventMove ?? false,
    opts.eventPhase ?? null,
    opts.officeMove ?? false,
    opts.projectManagerName ?? null,
  ).slice(0, 1500);

  const admin = createAdminClient();
  const outcome = await reserveStageNotification(admin, {
    jobType: opts.jobType,
    jobUuid: opts.jobUuid,
    status: String(opts.status),
    phone: raw,
    event: `tracking_${opts.status}`,
    message: body,
  });
  if (!outcome.reserved) return;
  const result = await sendSMS(raw, body);
  await finalizeStageNotification(admin, outcome.id, result.success, result.error);
}
