"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

/**
 * PM linking panel — surfaces the paired move when one is linked, and
 * lets admin search + link an existing move when not.
 *
 * Built 2026-06-27 from Oche's PM ask: a move-in needs to be linkable
 * to a move-out for the same unit, and vice versa, so dispatch can see
 * the pair as one operation. Backed by /api/admin/moves/[id]/link.
 *
 * Bidirectional: linking from A to B writes both A.linked_move_id=B and
 * B.linked_move_id=A. Unlinking clears both sides.
 */

type Move = {
  id: string;
  move_code: string;
  scheduled_date: string | null;
  status: string | null;
  unit_number: string | null;
  tenant_name: string | null;
  pm_reason_code: string | null;
  from_address: string | null;
  to_address: string | null;
  linked_move_id: string | null;
  linked_move_code: string | null;
  is_likely_pair?: boolean;
  same_unit?: boolean;
};

/**
 * Detect the "synthetic tenant" pattern from the PM batch flow: when a
 * coordinator doesn't supply a real tenant name, the batch row writes
 * the unit number into tenant_name as a placeholder (so reports still
 * have a column to display). On the move detail that placeholder reads
 * as if a real person is named — misleading for dispatch.
 *
 * 2026-06-28 Oche flagged: TENANT showing "1364" when the unit is also
 * "1364" should resolve to "Tenant not provided · partner-billed".
 */
function tenantIsSynthetic(
  tenantName: string | null | undefined,
  unitNumber: string | null | undefined,
): boolean {
  const t = (tenantName ?? "").trim().toLowerCase();
  const u = (unitNumber ?? "").trim().toLowerCase();
  if (!t) return true;
  if (!u) return false;
  // Exact match, or one contains the other (handles "1364" vs "Unit 1364"
  // and "1316 WL" vs "1316").
  return t === u || t.includes(u) || u.includes(t);
}

function displayTenant(
  tenantName: string | null | undefined,
  unitNumber: string | null | undefined,
): string {
  return tenantIsSynthetic(tenantName, unitNumber)
    ? "Tenant not provided · partner-billed"
    : String(tenantName ?? "").trim();
}

type LinkedSummary = {
  id: string;
  move_code: string;
  scheduled_date: string | null;
  status: string | null;
  pm_reason_code: string | null;
  unit_number: string | null;
  tenant_name: string | null;
};

export default function PmLinkSection({
  moveId,
  moveCode,
  isPmMove,
  partnerPropertyId,
  unitNumber,
  tenantName,
  buildingName,
  linkedMoveId,
  linkedMoveCode,
}: {
  moveId: string;
  moveCode: string;
  isPmMove: boolean;
  partnerPropertyId: string | null;
  unitNumber: string | null;
  tenantName: string | null;
  buildingName?: string | null;
  linkedMoveId: string | null;
  linkedMoveCode: string | null;
}) {
  const [candidates, setCandidates] = useState<Move[]>([]);
  const [search, setSearch] = useState("");
  const [linked, setLinked] = useState<LinkedSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Building name resolved by the API (joins partner_properties) — the
  // parent move row only carries the UUID, which is meaningless to
  // dispatch. 2026-06-28 fix.
  const [resolvedBuilding, setResolvedBuilding] = useState<string | null>(null);

  const refreshLinked = useCallback(async () => {
    if (!linkedMoveId) {
      setLinked(null);
      return;
    }
    try {
      const res = await fetch(`/api/admin/moves/${linkedMoveId}`);
      if (!res.ok) return;
      const data = (await res.json()) as Record<string, unknown>;
      setLinked({
        id: String(data.id ?? linkedMoveId),
        move_code: String(data.move_code ?? linkedMoveCode ?? ""),
        scheduled_date: (data.scheduled_date as string | null) ?? null,
        status: (data.status as string | null) ?? null,
        pm_reason_code: (data.pm_reason_code as string | null) ?? null,
        unit_number: (data.unit_number as string | null) ?? null,
        tenant_name: (data.tenant_name as string | null) ?? null,
      });
    } catch {
      // best-effort; leave linked null
    }
  }, [linkedMoveId, linkedMoveCode]);

  useEffect(() => {
    refreshLinked();
  }, [refreshLinked]);

  const searchCandidates = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/moves/${moveId}/link?q=${encodeURIComponent(q)}`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          candidates: Move[];
          self?: { building_name?: string | null };
        };
        setCandidates(data.candidates ?? []);
        if (data.self?.building_name) {
          setResolvedBuilding(data.self.building_name);
        }
      } catch {
        setCandidates([]);
      } finally {
        setLoading(false);
      }
    },
    [moveId],
  );

  // Auto-load same-building candidates when the panel opens (no link
  // yet). Also resolves the building name even when already linked, so
  // the top-row summary still shows a human-readable building.
  useEffect(() => {
    if (isPmMove) {
      searchCandidates("");
    }
  }, [linkedMoveId, isPmMove, searchCandidates]);

  async function link(otherMoveId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/moves/${moveId}/link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ other_move_id: otherMoveId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Link failed");
      } else {
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  async function unlink() {
    if (!confirm("Break the link between these two moves?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/moves/${moveId}/link`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Unlink failed");
      } else {
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!isPmMove) return null;

  return (
    <div className="rounded-xl border border-[var(--brd)] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]">
          PM unit & paired move
        </p>
        {moveCode && (
          <span className="text-[10px] font-mono text-[var(--tx3)]">{moveCode}</span>
        )}
      </div>

      {/* Building / unit / tenant summary.
          - Building: prefer the API-resolved name; the parent's prop
            falls back to "—" rather than the raw UUID.
          - Tenant: synthetic-tenant detection (tenant_name === unit
            number) renders "Tenant not provided · partner-billed" so
            dispatch knows there's no real contact to call. */}
      <div className="grid grid-cols-3 gap-3 text-[12px] pb-3 border-b border-[var(--brd)]/40">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--tx3)] mb-0.5">
            Building
          </p>
          <p className="text-[var(--tx)] font-medium truncate">
            {resolvedBuilding ?? buildingName ?? "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--tx3)] mb-0.5">
            Unit
          </p>
          <p className="text-[var(--tx)] font-mono">{unitNumber ?? "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider text-[var(--tx3)] mb-0.5">
            Tenant
          </p>
          <p
            className={`truncate ${tenantIsSynthetic(tenantName, unitNumber) ? "text-[var(--tx3)] italic" : "text-[var(--tx)]"}`}
          >
            {displayTenant(tenantName, unitNumber) || "—"}
          </p>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-md bg-red-50 border border-red-200 text-[11px] text-red-700">
          {error}
        </div>
      )}

      {linked ? (
        <div className="rounded-lg border border-[var(--wine)]/30 bg-[var(--wine)]/[0.04] p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] uppercase tracking-wider font-bold text-[var(--wine)]">
              Linked to
            </p>
            <button
              type="button"
              onClick={unlink}
              disabled={busy}
              className="text-[10px] uppercase tracking-wider font-semibold text-red-700 hover:underline disabled:opacity-50"
            >
              Unlink
            </button>
          </div>
          <Link
            href={`/admin/moves/${linked.id}`}
            className="block text-[13px] font-semibold text-[var(--wine)] hover:underline"
          >
            {linked.move_code}
          </Link>
          <div className="grid grid-cols-3 gap-2 text-[11px] text-[var(--tx2)]">
            <span>
              <span className="text-[var(--tx3)]">Reason: </span>
              {humanReason(linked.pm_reason_code)}
            </span>
            <span>
              <span className="text-[var(--tx3)]">Unit: </span>
              {linked.unit_number ?? "—"}
            </span>
            <span>
              <span className="text-[var(--tx3)]">Date: </span>
              {linked.scheduled_date ?? "—"}
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[11px] text-[var(--tx2)]">
            Link this move to a related one (e.g. the matching move-out for a
            move-in in the same unit). Search by move code, unit, or tenant
            name — defaults to other moves in the same building.
          </p>
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              searchCandidates(e.target.value);
            }}
            placeholder="MV-… / unit number / tenant"
            className="w-full px-3 py-2 rounded-md border border-[var(--brd)] bg-[var(--bg)] text-[12px]"
          />
          {loading ? (
            <p className="text-[11px] text-[var(--tx3)]">Searching…</p>
          ) : candidates.length === 0 ? (
            <p className="text-[11px] text-[var(--tx3)]">
              No candidates found in this building.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto rounded-md border border-[var(--brd)]/60 divide-y divide-[var(--brd)]/30">
              {candidates.map((c) => {
                const tenantStr = tenantIsSynthetic(c.tenant_name, c.unit_number)
                  ? "no tenant"
                  : (c.tenant_name || "").trim();
                return (
                  <div
                    key={c.id}
                    className={`px-3 py-2 flex items-center justify-between gap-2 hover:bg-[var(--bg)]/40 ${c.is_likely_pair ? "bg-[var(--wine)]/[0.05]" : ""}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[12px] font-mono font-semibold text-[var(--tx)]">
                          {c.move_code}
                        </p>
                        {c.is_likely_pair && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-[var(--wine)] text-white">
                            Likely pair
                          </span>
                        )}
                        {!c.is_likely_pair && c.same_unit && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-[var(--brd)]/40 text-[var(--tx2)]">
                            Same unit
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--tx3)] truncate mt-0.5">
                        {humanReason(c.pm_reason_code)} · Unit{" "}
                        {c.unit_number ?? "—"}
                        {tenantStr ? ` · ${tenantStr}` : ""} ·{" "}
                        {c.scheduled_date ?? "no date"}
                      </p>
                      {/* When a candidate is already linked, surface WHAT
                          it's linked to so admin can decide whether to
                          break that pairing first. Was just a flat
                          "already linked" before, with no context. */}
                      {c.linked_move_id && (
                        <p className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">
                          Linked to {c.linked_move_code ?? "another move"} —
                          unlink that pair first to use this one
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => link(c.id)}
                      disabled={busy || !!c.linked_move_id}
                      className="px-3 py-1 rounded-md bg-[var(--wine)] text-white text-[10px] font-semibold hover:opacity-90 disabled:opacity-40"
                    >
                      Link
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function humanReason(code: string | null | undefined): string {
  if (!code) return "—";
  return code
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
