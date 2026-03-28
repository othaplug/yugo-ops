export type LeadSource =
  | "website_form"
  | "phone_call"
  | "email"
  | "google_ads"
  | "referral"
  | "partner_referral"
  | "realtor"
  | "walk_in"
  | "social_media"
  | "repeat_client"
  | "other";

export type LeadPriority = "urgent" | "high" | "normal" | "low";

export function daysBetween(a: Date, b: Date): number {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / 86_400_000);
}

export function determinePriority(lead: {
  source?: LeadSource | string | null;
  move_size?: string | null;
  preferred_date?: string | null;
  service_type?: string | null;
  message?: string | null;
  source_detail?: string | null;
}): LeadPriority {
  const src = lead.source as string | undefined;
  if (src === "google_ads") return "high";
  if (src === "referral" || src === "partner_referral" || src === "realtor") return "high";

  const ms = lead.move_size || "";
  if (["4br", "5br_plus"].includes(ms)) return "high";

  const detail = (lead.source_detail || "").toLowerCase();
  if (src === "phone_call" && (detail.includes("missed") || detail.includes("voicemail"))) {
    return "urgent";
  }

  if (lead.preferred_date) {
    const d = new Date(lead.preferred_date + "T12:00:00");
    if (!Number.isNaN(d.getTime())) {
      const days = daysBetween(new Date(), d);
      if (days >= 0 && days <= 7) return "urgent";
      if (days <= 14) return "high";
    }
  }

  const svc = (lead.service_type || "").toLowerCase();
  const msg = (lead.message || "").toLowerCase();
  if (svc === "white_glove" || msg.includes("estate")) return "high";

  return "normal";
}

export function estimateValue(moveSize: string | undefined | null): number {
  const values: Record<string, number> = {
    studio: 550,
    "1br": 700,
    "2br": 1100,
    "3br": 1600,
    "4br": 2200,
    "5br_plus": 3000,
    partial: 450,
  };
  return values[moveSize || ""] ?? 800;
}
