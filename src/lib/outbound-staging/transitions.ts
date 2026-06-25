/**
 * Outbound staging — status state machine.
 *
 * Encodes the lifecycle as data rather than scattered if-statements so the
 * admin UI, the transition endpoint, and the partner-facing tracker all
 * read from one source of truth. New statuses are added in one place.
 */

export type OutboundStagingStatus =
  | "draft"
  | "scheduled"
  | "picked_up"
  | "at_warehouse"
  | "palletizing"
  | "ready_for_carrier"
  | "handed_off"
  | "completed"
  | "cancelled";

export const OUTBOUND_STAGING_STATUS_LABELS: Record<OutboundStagingStatus, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  picked_up: "Picked up",
  at_warehouse: "At warehouse",
  palletizing: "Palletizing",
  ready_for_carrier: "Ready for carrier",
  handed_off: "Handed off",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * Client-friendly labels for the partner tracking page. Slightly softer than
 * the operator-facing copy so partners aren't reading raw ops vocabulary.
 */
export const OUTBOUND_STAGING_PARTNER_LABELS: Record<OutboundStagingStatus, string> = {
  draft: "Drafting",
  scheduled: "Scheduled for pickup",
  picked_up: "Picked up from consignor",
  at_warehouse: "Arrived at Yugo warehouse",
  palletizing: "Preparing for carrier",
  ready_for_carrier: "Ready for carrier pickup",
  handed_off: "Handed to carrier",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Forward-only transitions allowed in the happy path. */
const FORWARD_TRANSITIONS: Record<OutboundStagingStatus, OutboundStagingStatus[]> = {
  draft: ["scheduled", "cancelled"],
  scheduled: ["picked_up", "cancelled"],
  picked_up: ["at_warehouse", "cancelled"],
  at_warehouse: ["palletizing", "cancelled"],
  palletizing: ["ready_for_carrier", "cancelled"],
  ready_for_carrier: ["handed_off", "cancelled"],
  handed_off: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

/**
 * Required fields per transition. Enforced in the API so a coordinator can't
 * mark a shipment ready_for_carrier without recording the pallet specs, or
 * handed_off without a PRO + carrier name.
 *
 * This is the load-bearing guardrail — without these, the record looks
 * complete but is operationally useless because the data the partner needs
 * (BOL, PRO, pallet weight) isn't captured.
 */
export const REQUIRED_FIELDS_FOR_TRANSITION: Partial<
  Record<OutboundStagingStatus, string[]>
> = {
  scheduled: ["scheduled_pickup_date", "consignor_address"],
  picked_up: ["picked_up_at"],
  at_warehouse: ["received_at_warehouse_at"],
  palletizing: ["palletizing_started_at"],
  ready_for_carrier: ["palletized_at", "pallet_count", "pallet_weight_lb"],
  handed_off: ["handed_off_at", "carrier_name", "carrier_bol_number"],
};

export type TransitionGuardResult = { ok: true } | { ok: false; reason: string };

export function canTransition(
  from: OutboundStagingStatus,
  to: OutboundStagingStatus,
): boolean {
  const allowed = FORWARD_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

/**
 * Validate a payload satisfies the required fields for the target status.
 *
 * `row` is the shipment row WITH the patch already merged on top, so the
 * check covers the post-transition state.
 */
export function guardTransition(
  from: OutboundStagingStatus,
  to: OutboundStagingStatus,
  row: Record<string, unknown>,
): TransitionGuardResult {
  if (!canTransition(from, to)) {
    return {
      ok: false,
      reason: `Cannot move from '${from}' to '${to}' — not a valid transition.`,
    };
  }
  const required = REQUIRED_FIELDS_FOR_TRANSITION[to] ?? [];
  for (const f of required) {
    const v = row[f];
    if (v === null || v === undefined || v === "" || (typeof v === "number" && !Number.isFinite(v))) {
      return {
        ok: false,
        reason: `Cannot move to '${to}' — '${f}' is required and missing.`,
      };
    }
  }
  return { ok: true };
}

/** Visible-to-everyone ordered status list for progress bars and dashboards. */
export const OUTBOUND_STAGING_HAPPY_PATH: OutboundStagingStatus[] = [
  "scheduled",
  "picked_up",
  "at_warehouse",
  "palletizing",
  "ready_for_carrier",
  "handed_off",
  "completed",
];

/** Per-status timestamp field used to set "when did we cross this gate?" */
export const STATUS_TIMESTAMP_FIELDS: Partial<Record<OutboundStagingStatus, string>> = {
  picked_up: "picked_up_at",
  at_warehouse: "received_at_warehouse_at",
  palletizing: "palletizing_started_at",
  ready_for_carrier: "ready_for_carrier_at",
  handed_off: "handed_off_at",
  completed: "completed_at",
  cancelled: "cancelled_at",
};
