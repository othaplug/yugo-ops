/** Crew "Report issue" codes stored in incidents.issue_type */
export const MOVE_DAY_ISSUE_OPTIONS: {
  code: string;
  label: string;
  urgency: "high" | "medium" | "low";
}[] = [
  { code: "client_absent", label: "Client not present", urgency: "high" },
  { code: "access_denied", label: "Building access denied", urgency: "high" },
  { code: "elevator_unavailable", label: "Elevator not booked / unavailable", urgency: "high" },
  { code: "no_parking", label: "No parking available", urgency: "medium" },
  { code: "inventory_mismatch", label: "More items than quoted", urgency: "medium" },
  { code: "access_difficulty", label: "Difficult access (stairs, tight hallway)", urgency: "low" },
  { code: "weather", label: "Weather delay", urgency: "low" },
  { code: "damage_pre_existing", label: "Pre-existing damage found", urgency: "low" },
  { code: "damage", label: "Damage", urgency: "medium" },
  { code: "delay", label: "Delay", urgency: "medium" },
  { code: "missing_item", label: "Missing item", urgency: "medium" },
  { code: "access_problem", label: "Access problem", urgency: "high" },
  { code: "other", label: "Other", urgency: "medium" },
];

export function labelForIssueCode(code: string): string {
  return MOVE_DAY_ISSUE_OPTIONS.find((o) => o.code === code)?.label ?? code;
}

export function defaultUrgencyForIssue(code: string): "high" | "medium" | "low" {
  return MOVE_DAY_ISSUE_OPTIONS.find((o) => o.code === code)?.urgency ?? "medium";
}
