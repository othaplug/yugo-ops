import type { ParsedCaptureForm } from "./parse-capture-form";
import type { ParsedInventory } from "./auto-parse-inventory";
import { detectMultipleDates } from "./detect-multiple-dates";
import { detectServiceTypeFromText, type DetectedServiceType } from "./detect-service-type-text";

export type CompletenessPath = "auto_quote" | "needs_info" | "manual_review";

export type CompletenessCheck = {
  path: CompletenessPath;
  score: number;
  present: string[];
  missing: string[];
  clarifications_needed: string[];
};

const MOVE_SIZE_NA = new Set(["event", "labour_only", "b2b_oneoff", "bin_rental"]);

export type CompletenessContext = {
  /** Text detection from capture (omit when service came from the form). */
  service_inferred?: DetectedServiceType | null;
};

function normAddr(s: string | null | undefined): string {
  return (s || "").trim();
}

/**
 * Score the lead for auto-quote vs follow-up vs manual coordinator review.
 * `parsed.service_type` should already reflect high-confidence text detection when the form left it blank.
 */
export function assessCompleteness(
  parsed: ParsedCaptureForm,
  inventory: ParsedInventory,
  ctx?: CompletenessContext,
): CompletenessCheck {
  const present: string[] = [];
  const missing: string[] = [];
  const clarifications: string[] = [];

  const fn = (parsed.first_name || "").trim();
  const ln = (parsed.last_name || "").trim();
  if (fn || ln) present.push("name");
  else missing.push("name");

  if (parsed.email || parsed.phone) present.push("contact");
  else missing.push("contact — no email or phone");

  const fromA = normAddr(parsed.from_address);
  const toA = normAddr(parsed.to_address);
  if (fromA.length > 10) present.push("from_address");
  else if (fromA.length > 0) clarifications.push("From address seems incomplete — confirm full address");
  else missing.push("from_address");

  if (toA.length > 10) {
    if (fromA && toA && fromA.toLowerCase() === toA.toLowerCase()) {
      clarifications.push(
        "From and To are the same address — is this an in-building move or labour-only?",
      );
      present.push("to_address");
    } else {
      present.push("to_address");
    }
  } else if (toA.length > 0) clarifications.push("To address seems incomplete");
  else missing.push("to_address");

  if (parsed.preferred_date) present.push("date");
  else missing.push("preferred_date");

  const st = (parsed.service_type || "").trim() || null;
  const guess =
    ctx?.service_inferred ??
    detectServiceTypeFromText(parsed.message || "", parsed.inventory_text || "");
  if (!st) {
    if (guess) {
      present.push(`service_type (auto-detected: ${guess.slug})`);
      if (guess.confidence < 0.8) {
        clarifications.push(
          `Service type detected as "${guess.slug}" but confidence is low — verify`,
        );
      }
    } else {
      clarifications.push("Service type unclear — use form or describe the job in your reply");
    }
  } else {
    present.push("service_type");
    const inf = ctx?.service_inferred;
    if (inf && inf.slug === st && inf.confidence < 0.8) {
      clarifications.push(`Service type inferred as "${st}" with moderate confidence — verify`);
    }
  }

  const moveNa = st && MOVE_SIZE_NA.has(st);
  if (parsed.move_size) present.push("move_size");
  else if (moveNa) present.push("move_size — not applicable for this service type");
  else clarifications.push("Move size not specified — estimate from inventory or ask");

  const blob = `${parsed.message || ""}\n${parsed.inventory_text || ""}`;
  if (inventory.items.length > 0 && inventory.confidence !== "none") {
    present.push(`inventory (${inventory.totalItems} items parsed)`);
  } else if ((parsed.message || "").trim().length > 50) {
    clarifications.push("No inventory list — client described needs in message. Review manually.");
  } else {
    missing.push("inventory — no items provided");
  }

  const multi = detectMultipleDates(blob);
  if (multi.length > 1) {
    clarifications.push(
      `Multiple dates detected: ${multi.join(", ")}. This may be a multi-day event or recurring service.`,
    );
  }

  const totalFields = 7;
  const score = Math.round((present.length / totalFields) * 100);

  let path: CompletenessPath;
  if (score >= 80 && missing.length === 0 && clarifications.length <= 1) {
    path = "auto_quote";
  } else if (score >= 50 && missing.length <= 2) {
    path = "needs_info";
  } else {
    path = "manual_review";
  }

  if (st === "event" || (!st && clarifications.some((c) => /event/i.test(c)))) {
    path = clarifications.length > 2 ? "manual_review" : path === "auto_quote" ? "needs_info" : path;
  }

  if (missing.includes("contact — no email or phone")) {
    path = "manual_review";
  }

  if (clarifications.some((c) => /Review manually/i.test(c)) && missing.length >= 2) {
    path = "manual_review";
  }

  return { path, score, present, missing, clarifications_needed: clarifications };
}
