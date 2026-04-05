/**
 * Mock {@link move} rows for `/track/move/preview-*` pages (Signature tier, cream shell).
 * IDs are fixed so you could special-case APIs later; APIs currently 404 silently.
 */
export const PREVIEW_TRACK_TOKEN = "client-ui-preview-demo";

const ACTIVE_ID = "11111111-1111-4111-8111-111111111101";
const COMPLETED_ID = "11111111-1111-4111-8111-111111111102";
const MOVE_DAY_ID = "11111111-1111-4111-8111-111111111103";
const ESTATE_ACTIVE_ID = "11111111-1111-4111-8111-111111111104";

function addDaysFromToday(delta: number): string {
  const d = new Date();
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Confirmed Signature move, move day in ~10 days (countdown, tabs, cream theme). */
export function buildStandardTrackPreviewMoveActive(): Record<string, unknown> {
  return {
    id: ACTIVE_ID,
    move_code: "SAMPLE-ACTIVE",
    client_name: "Alex Sample",
    client_email: "alex.sample@example.com",
    client_phone: "4165550100",
    status: "confirmed",
    stage: null,
    tier_selected: "signature",
    service_tier: "signature",
    service_type: "local_move",
    move_type: "residential",
    scheduled_date: addDaysFromToday(10),
    arrival_window: "Morning (7 AM – 12 PM)",
    from_address: "45 Charles St E, Toronto, ON",
    to_address: "210 Bloor St W, Toronto, ON",
    from_access: "elevator_booked",
    to_access: "stairs_walkup",
    amount: 2849,
    estimate: 2521,
    balance_amount: 0,
    deposit_amount: 712,
    balance_paid_at: new Date().toISOString(),
    deposit_paid_at: new Date().toISOString(),
    square_card_id: null,
    square_customer_id: null,
    crew_id: null,
    crew_size: 3,
    truck_info: "20ft",
    assigned_members: ["Jordan", "Sam", "Casey"],
    coordinator_name: "Sam Coordinator",
    coordinator_phone: "(647) 370-4525",
    coordinator_email: "coord@helloyugo.com",
    client_room_photos: {},
    event_name: null,
    event_phase: null,
    pending_inventory_change_request_id: null,
    eta_current_minutes: null,
    tip_prompt_shown_at: null,
  };
}

/** Same as {@link buildStandardTrackPreviewMoveActive} but Estate tier (UI is identical). */
export function buildEstateTrackPreviewMoveActive(): Record<string, unknown> {
  const base = buildStandardTrackPreviewMoveActive();
  return {
    ...base,
    id: ESTATE_ACTIVE_ID,
    move_code: "ESTATE-SAMPLE",
    tier_selected: "estate",
    service_tier: "estate",
    estate_service_checklist: {},
    move_size: "3br",
    inventory_score: 40,
  };
}

/**
 * Estate track preview: first timeline milestone checked (pre-move walkthrough),
 * so designers can see completed-node styling on the wine stepper.
 */
export function buildEstateTrackPreviewMoveWalkthroughDone(): Record<string, unknown> {
  const base = buildEstateTrackPreviewMoveActive();
  return {
    ...base,
    estate_service_checklist: {
      estate_walkthrough: true,
    },
  };
}

/**
 * Move day: `scheduled_date` is today so `daysUntil === 0` → “Today’s the day” hero
 * (client math: move midnight has passed, diff / 1d ceils to 0).
 */
export function buildStandardTrackPreviewMoveMoveDay(): Record<string, unknown> {
  return {
    id: MOVE_DAY_ID,
    move_code: "SAMPLE-TODAY",
    client_name: "Alex Sample",
    client_email: "alex.sample@example.com",
    client_phone: "4165550100",
    status: "confirmed",
    stage: null,
    tier_selected: "signature",
    service_tier: "signature",
    service_type: "local_move",
    move_type: "residential",
    scheduled_date: addDaysFromToday(0),
    arrival_window: "Morning (7 AM – 12 PM)",
    from_address: "45 Charles St E, Toronto, ON",
    to_address: "210 Bloor St W, Toronto, ON",
    from_access: "elevator_booked",
    to_access: "stairs_walkup",
    amount: 2849,
    estimate: 2521,
    balance_amount: 0,
    deposit_amount: 712,
    balance_paid_at: new Date().toISOString(),
    deposit_paid_at: new Date().toISOString(),
    square_card_id: null,
    square_customer_id: null,
    crew_id: null,
    crew_size: 3,
    truck_info: "20ft",
    assigned_members: ["Jordan", "Sam", "Casey"],
    coordinator_name: "Sam Coordinator",
    coordinator_phone: "(647) 370-4525",
    coordinator_email: "coord@helloyugo.com",
    client_room_photos: {},
    event_name: null,
    event_phase: null,
    pending_inventory_change_request_id: null,
    eta_current_minutes: null,
    tip_prompt_shown_at: null,
  };
}

/** Completed move: perks hub, referral block, no live tabs (same as production). */
export function buildStandardTrackPreviewMoveCompleted(): Record<string, unknown> {
  return {
    id: COMPLETED_ID,
    move_code: "SAMPLE-DONE",
    client_name: "Alex Sample",
    client_email: "alex.sample@example.com",
    client_phone: "4165550100",
    status: "completed",
    stage: "completed",
    tier_selected: "signature",
    service_tier: "signature",
    service_type: "local_move",
    move_type: "residential",
    scheduled_date: addDaysFromToday(-12),
    arrival_window: "Morning (7 AM – 12 PM)",
    from_address: "45 Charles St E, Toronto, ON",
    to_address: "210 Bloor St W, Toronto, ON",
    amount: 2849,
    estimate: 2521,
    balance_amount: 0,
    deposit_amount: 712,
    balance_paid_at: new Date().toISOString(),
    deposit_paid_at: new Date().toISOString(),
    square_card_id: null,
    square_customer_id: null,
    crew_id: null,
    crew_size: 3,
    truck_info: "20ft",
    assigned_members: ["Jordan", "Sam", "Casey"],
    coordinator_name: "Sam Coordinator",
    coordinator_phone: "(647) 370-4525",
    coordinator_email: "coord@helloyugo.com",
    client_room_photos: {},
    event_name: null,
    event_phase: null,
    pending_inventory_change_request_id: null,
    eta_current_minutes: null,
    tip_prompt_shown_at: new Date().toISOString(),
  };
}
