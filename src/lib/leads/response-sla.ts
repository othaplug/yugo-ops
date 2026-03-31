/**
 * First-response SLA: default 5 minutes from lead creation.
 * Prefer `response_sla_target_at` when present (DB trigger); else derive from `created_at`.
 */

export function leadResponseSlaTargetMs(lead: {
  response_sla_target_at?: string | null;
  created_at?: string | null;
}): number | null {
  const explicit = lead.response_sla_target_at;
  if (explicit) {
    const t = new Date(explicit).getTime();
    return Number.isFinite(t) ? t : null;
  }
  const created = lead.created_at;
  if (!created) return null;
  const t0 = new Date(created).getTime();
  if (!Number.isFinite(t0)) return null;
  return t0 + 5 * 60_000;
}
