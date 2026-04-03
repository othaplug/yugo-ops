/**
 * HubSpot deal pipeline: logical stage names → platform_config keys (try in order).
 * Configure internal stage IDs in platform_config or env (e.g. HUBSPOT_STAGE_QUOTE_SENT).
 *
 * @see https://developers.hubspot.com/docs/api/crm/pipelines#deal-pipelines
 */
export const LOGICAL_STAGE_PLATFORM_KEYS: Record<string, readonly string[]> = {
  new_lead: ["hubspot_stage_new_lead"],
  contacted: ["hubspot_stage_contacted"],
  quote_draft: ["hubspot_stage_quote_draft"],
  quote_sent: ["hubspot_stage_quote_sent"],
  quote_viewed: ["hubspot_stage_quote_viewed"],
  booked: ["hubspot_stage_booked", "hubspot_stage_deposit_received"],
  deposit_received: ["hubspot_stage_deposit_received"],
  scheduled: ["hubspot_stage_scheduled", "hubspot_stage_booked"],
  in_progress: ["hubspot_stage_in_progress", "hubspot_stage_booked"],
  closed_won: ["hubspot_stage_closed_won"],
  closed_lost: ["hubspot_stage_closed_lost"],
  /** Partner onboarding — optional; falls back to closed won if unset */
  partner_signed: ["hubspot_stage_partner_signed", "hubspot_stage_closed_won"],
};

/**
 * Triggers from app code (quote/move/delivery lifecycle) → logical HubSpot stage.
 * Used by syncDealStage().
 */
export const YUGO_TRIGGER_TO_LOGICAL_STAGE: Record<string, string> = {
  quote_sent: "quote_sent",
  sent: "quote_sent",
  viewed: "quote_viewed",
  quote_viewed: "quote_viewed",
  draft: "quote_draft",
  confirmed: "booked",
  scheduled: "scheduled",
  in_progress: "in_progress",
  completed: "closed_won",
  paid: "closed_won",
  cancelled: "closed_lost",
  expired: "closed_lost",
  partner_signed: "partner_signed",
};
