import { normalizePhone } from "@/lib/phone";

/**
 * Additional contacts on a move — extra people who also receive move-day
 * tracking and/or pre-move reminders alongside the primary client. Stored as a
 * JSONB array on moves.additional_contacts (see migration
 * 20260925120000_moves_additional_contacts.sql). Admin-added post-booking via
 * the move contact modal.
 */
export type AdditionalContact = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  /** Receives live move-day tracking (SMS + email). Default true. */
  tracking?: boolean;
  /** Receives pre-move reminders + schedule-change updates. Default true. */
  reminders?: boolean;
};

export type MoveRecipientPurpose = "tracking" | "reminders";

export type MoveRecipient = {
  name: string | null;
  email: string | null;
  phone: string | null;
  role: "primary" | "additional";
};

type MoveLike = {
  client_name?: string | null;
  client_email?: string | null;
  client_phone?: string | null;
  additional_contacts?: unknown;
};

/** Parse the JSONB column defensively — it may be a string, array, or null. */
export function parseAdditionalContacts(raw: unknown): AdditionalContact[] {
  let val = raw;
  if (typeof val === "string") {
    try {
      val = JSON.parse(val);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(val)) return [];
  return val.filter((c): c is AdditionalContact => !!c && typeof c === "object");
}

const emailKey = (e: string | null | undefined) => (e || "").trim().toLowerCase();
const phoneKey = (p: string | null | undefined) => normalizePhone(p || "") || "";

/**
 * Resolve everyone who should be notified for a move for a given purpose. Always
 * includes the primary client, plus each additional contact whose toggle for
 * that purpose is on (default on). Deduped by normalized phone AND lowercased
 * email — the primary always wins a tie, so a shared number/email is never
 * doubled. Callers filter to entries with a usable phone (SMS) or email (email)
 * with `recipientsWithPhone` / `recipientsWithEmail`.
 */
export function getMoveClientRecipients(
  move: MoveLike,
  purpose: MoveRecipientPurpose,
): MoveRecipient[] {
  const out: MoveRecipient[] = [];
  const seenPhone = new Set<string>();
  const seenEmail = new Set<string>();

  const push = (r: MoveRecipient) => {
    const pk = phoneKey(r.phone);
    const ek = emailKey(r.email);
    // Drop a duplicate only on the identifier(s) it actually shares; keep an
    // entry that brings a NEW phone or email even if the other field collides.
    const phoneDup = pk ? seenPhone.has(pk) : false;
    const emailDup = ek ? seenEmail.has(ek) : false;
    const hasNewPhone = !!pk && !phoneDup;
    const hasNewEmail = !!ek && !emailDup;
    if (!pk && !ek) return; // nothing to reach them by
    if (!hasNewPhone && !hasNewEmail) return; // fully covered already
    if (pk) seenPhone.add(pk);
    if (ek) seenEmail.add(ek);
    out.push({
      name: r.name,
      // Null out a field that duplicates an earlier recipient so a caller
      // fanning that channel doesn't message the same address twice.
      phone: hasNewPhone ? r.phone : null,
      email: hasNewEmail ? r.email : null,
      role: r.role,
    });
  };

  push({
    name: move.client_name ?? null,
    email: move.client_email ?? null,
    phone: move.client_phone ?? null,
    role: "primary",
  });

  for (const c of parseAdditionalContacts(move.additional_contacts)) {
    const on = purpose === "tracking" ? c.tracking !== false : c.reminders !== false;
    if (!on) continue;
    push({
      name: c.name ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      role: "additional",
    });
  }

  return out;
}

/** Recipients that can be reached by SMS (valid phone), deduped. */
export function recipientsWithPhone(recipients: MoveRecipient[]): MoveRecipient[] {
  return recipients.filter((r) => phoneKey(r.phone).length >= 10);
}

/** Recipients that can be reached by email, deduped. */
export function recipientsWithEmail(recipients: MoveRecipient[]): MoveRecipient[] {
  return recipients.filter((r) => emailKey(r.email).length > 0);
}
