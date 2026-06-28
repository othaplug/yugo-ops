/**
 * PM move pairing — admin links one move to a related move (typically a
 * move-out paired with a move-in for the same unit in the same building,
 * or the two halves of a suite-transfer).
 *
 *   POST   /api/admin/moves/[id]/link   { other_move_id }   — link both sides
 *   DELETE /api/admin/moves/[id]/link                       — break the link
 *   GET    /api/admin/moves/[id]/link?building=…&q=…        — candidate search
 *
 * Built 2026-06-27 from Oche's PM ask: "we should be able to link similar
 * moves — a move-in linked to a move-out of the same unit, and vice versa".
 *
 * Bidirectionality: when admin links A to B, BOTH rows get the other's id
 * + code written to `linked_move_id` / `linked_move_code`. Same on
 * unlink — clear both sides — so the dispatcher never sees a half-broken
 * link where one move references a stale paired id.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id } = await params;
  let body: { other_move_id?: string };
  try {
    body = (await req.json()) as { other_move_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const otherId = (body.other_move_id || "").trim();
  if (!otherId) {
    return NextResponse.json({ error: "other_move_id is required" }, { status: 400 });
  }
  if (otherId === id) {
    return NextResponse.json(
      { error: "Cannot link a move to itself" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: a } = await admin
    .from("moves")
    .select("id, move_code, linked_move_id, linked_move_code")
    .or(`id.eq.${id},move_code.eq.${id}`)
    .maybeSingle();
  const { data: b } = await admin
    .from("moves")
    .select("id, move_code, linked_move_id, linked_move_code")
    .or(`id.eq.${otherId},move_code.eq.${otherId}`)
    .maybeSingle();

  if (!a || !b) {
    return NextResponse.json(
      { error: "One or both moves not found" },
      { status: 404 },
    );
  }

  // Refuse if either side is already linked to a DIFFERENT move. Forces
  // the admin to break the existing link first, instead of silently
  // dropping it. Re-linking the same pair is a no-op.
  if (a.linked_move_id && a.linked_move_id !== b.id) {
    return NextResponse.json(
      {
        error: `Move ${a.move_code} is already linked to ${a.linked_move_code ?? "another move"}. Unlink first.`,
      },
      { status: 409 },
    );
  }
  if (b.linked_move_id && b.linked_move_id !== a.id) {
    return NextResponse.json(
      {
        error: `Move ${b.move_code} is already linked to ${b.linked_move_code ?? "another move"}. Unlink first.`,
      },
      { status: 409 },
    );
  }

  const { error: ea } = await admin
    .from("moves")
    .update({ linked_move_id: b.id, linked_move_code: b.move_code })
    .eq("id", a.id);
  const { error: eb } = await admin
    .from("moves")
    .update({ linked_move_id: a.id, linked_move_code: a.move_code })
    .eq("id", b.id);
  if (ea || eb) {
    return NextResponse.json(
      { error: ea?.message || eb?.message || "Link write failed" },
      { status: 500 },
    );
  }

  await logAudit({
    userId: user?.id,
    userEmail: user?.email,
    action: "edit_move",
    resourceType: "move",
    resourceId: a.id,
    details: {
      change: "linked_move_pair_created",
      a_move_code: a.move_code,
      b_move_code: b.move_code,
    },
  });

  return NextResponse.json({
    ok: true,
    linked: { a: a.move_code, b: b.move_code },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id } = await params;
  const admin = createAdminClient();
  const { data: a } = await admin
    .from("moves")
    .select("id, move_code, linked_move_id, linked_move_code")
    .or(`id.eq.${id},move_code.eq.${id}`)
    .maybeSingle();
  if (!a) return NextResponse.json({ error: "Move not found" }, { status: 404 });
  if (!a.linked_move_id) {
    return NextResponse.json({ ok: true, message: "No link to break" });
  }

  const otherId = a.linked_move_id;
  const { error: ea } = await admin
    .from("moves")
    .update({ linked_move_id: null, linked_move_code: null })
    .eq("id", a.id);
  const { error: eb } = await admin
    .from("moves")
    .update({ linked_move_id: null, linked_move_code: null })
    .eq("id", otherId);
  if (ea || eb) {
    return NextResponse.json(
      { error: ea?.message || eb?.message || "Unlink write failed" },
      { status: 500 },
    );
  }

  await logAudit({
    userId: user?.id,
    userEmail: user?.email,
    action: "edit_move",
    resourceType: "move",
    resourceId: a.id,
    details: {
      change: "linked_move_pair_broken",
      a_move_code: a.move_code,
      b_move_code: a.linked_move_code,
    },
  });

  return NextResponse.json({ ok: true });
}

/**
 * Opposite-reason pairs used to surface "Likely pair" suggestions. The
 * list is intentionally narrow — a reno_move_out for Unit 207 should
 * suggest a reno_move_in for Unit 207, and vice versa. Suite transfers
 * pair to themselves; bundles don't have a natural opposite.
 */
const OPPOSITE_REASON: Record<string, string> = {
  reno_move_in: "reno_move_out",
  reno_move_out: "reno_move_in",
  tenant_move_in: "tenant_move_out",
  tenant_move_out: "tenant_move_in",
  suite_transfer: "suite_transfer",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id } = await params;
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();

  const admin = createAdminClient();
  const { data: self } = await admin
    .from("moves")
    .select(
      "id, partner_property_id, unit_number, tenant_name, is_pm_move, pm_reason_code",
    )
    .or(`id.eq.${id},move_code.eq.${id}`)
    .maybeSingle();
  if (!self) return NextResponse.json({ candidates: [] });

  // Resolve the human-readable building name so the UI doesn't have to
  // display a raw UUID. Best-effort — falls back to null and the UI
  // shows "—" rather than failing.
  let building_name: string | null = null;
  if (self.partner_property_id) {
    const { data: prop } = await admin
      .from("partner_properties")
      .select("building_name")
      .eq("id", self.partner_property_id)
      .maybeSingle();
    building_name = (prop?.building_name as string | null) ?? null;
  }

  // Candidate scoring: prefer same building, then most-recent PM moves.
  // The list never auto-applies — the admin confirms the pairing.
  let query = admin
    .from("moves")
    .select(
      "id, move_code, scheduled_date, status, partner_property_id, unit_number, tenant_name, pm_reason_code, from_address, to_address, linked_move_id, linked_move_code",
    )
    .neq("id", self.id)
    .order("scheduled_date", { ascending: false })
    .limit(60);

  if (self.partner_property_id) {
    query = query.eq("partner_property_id", self.partner_property_id);
  }
  if (q) {
    // Free-text fallback when admin types something specific.
    query = query.or(
      `move_code.ilike.%${q}%,unit_number.ilike.%${q}%,tenant_name.ilike.%${q}%`,
    );
  }

  const { data: rawCandidates, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Augment each candidate with `is_likely_pair` (same unit + opposite
  // reason as self) so the UI can surface a "Likely pair" badge and
  // sort those to the top — the most useful candidates first.
  const wantedReason = self.pm_reason_code
    ? OPPOSITE_REASON[String(self.pm_reason_code)] ?? null
    : null;
  const selfUnit = (self.unit_number || "").trim().toLowerCase();
  const candidates = (rawCandidates ?? [])
    .map((c) => {
      const sameUnit =
        !!selfUnit &&
        (c.unit_number || "").trim().toLowerCase() === selfUnit;
      const oppositeReason =
        !!wantedReason && String(c.pm_reason_code) === wantedReason;
      return {
        ...c,
        is_likely_pair: sameUnit && oppositeReason,
        same_unit: sameUnit,
      };
    })
    .sort((a, b) => {
      // Likely pair first (same unit + opposite reason), then same-unit
      // (any reason), then by scheduled_date desc.
      if (a.is_likely_pair !== b.is_likely_pair) {
        return a.is_likely_pair ? -1 : 1;
      }
      if (a.same_unit !== b.same_unit) return a.same_unit ? -1 : 1;
      const ad = a.scheduled_date || "";
      const bd = b.scheduled_date || "";
      return ad < bd ? 1 : ad > bd ? -1 : 0;
    });

  return NextResponse.json({
    self: {
      partner_property_id: self.partner_property_id,
      building_name,
      unit_number: self.unit_number,
      tenant_name: self.tenant_name,
      pm_reason_code: self.pm_reason_code,
    },
    candidates,
  });
}
