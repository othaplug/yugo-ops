/** Human-readable labels for admin Leads UI (never show raw DB enums to clients). */

export const LEAD_SOURCE_LABELS: Record<string, string> = {
  website_form: "Website form",
  phone_call: "Phone",
  email: "Email",
  google_ads: "Google Ads",
  referral: "Referral",
  partner_referral: "Partner referral",
  realtor: "Realtor",
  walk_in: "Walk-in",
  social_media: "Social media",
  repeat_client: "Repeat client",
  other: "Other",
};

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  assigned: "Assigned",
  follow_up_sent: "Follow-up sent",
  awaiting_reply: "Awaiting reply",
  contacted: "Contacted",
  qualified: "Qualified",
  quote_sent: "Quote sent",
  follow_up: "Follow up",
  converted: "Converted",
  lost: "Lost",
  disqualified: "Disqualified",
  stale: "Stale",
};

export const COMPLETENESS_PATH_LABELS: Record<string, string> = {
  auto_quote: "Auto-quote ready",
  needs_info: "Needs info",
  manual_review: "Manual review",
};

export const LEAD_PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  normal: "Normal",
  low: "Low",
};

export const LEAD_ACTIVITY_LABELS: Record<string, string> = {
  created: "Created",
  assigned: "Assigned",
  viewed: "Viewed",
  contacted: "Contacted",
  quote_sent: "Quote sent",
  follow_up_sent: "Follow-up sent",
  follow_up_scheduled: "Follow-up scheduled",
  follow_up_completed: "Follow-up completed",
  status_changed: "Status changed",
  note_added: "Note added",
  converted: "Converted",
  lost: "Lost",
};

/** Parsed / inferred service slugs shown on lead detail (coordinator-facing). */
export const DETECTED_SERVICE_TYPE_LABELS: Record<string, string> = {
  pm_inquiry: "Property management inquiry",
};

export const DISMISS_REASONS: { value: string; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "wrong_service_area", label: "Wrong service area" },
  { value: "not_a_real_inquiry", label: "Not a real inquiry" },
  { value: "duplicate", label: "Duplicate" },
];
