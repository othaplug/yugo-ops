"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/design-system/admin/layout";
import { Button } from "@/design-system/admin/primitives";
import { useToast } from "@/app/admin/components/Toast";
import { formatCurrency } from "@/lib/format-currency";
import { formatMoveDate } from "@/lib/date-format";
import { Plus } from "@phosphor-icons/react";
import { PMBatchMoveRow, type PMBatchRowState, emptyPmBatchRow } from "./PMBatchMoveRow";

type PartnerOption = { id: string; name: string | null; vertical: string | null };

type Bootstrap = {
  org: { id: string; name: string | null; vertical: string | null };
  contract: { id: string; rate_card?: unknown } | null;
  properties: {
    id: string;
    building_name: string;
    address: string;
    service_region?: string | null;
  }[];
  reason_labels: Record<string, string>;
  rate_preview: { reason_code: string; unit_size: string; base_rate: number }[];
};

export function PMBatchClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [partners, setPartners] = React.useState<PartnerOption[]>([]);
  const [partnerId, setPartnerId] = React.useState("");
  const [bootstrap, setBootstrap] = React.useState<Bootstrap | null>(null);
  const [loadingPartners, setLoadingPartners] = React.useState(true);
  const [loadingBoot, setLoadingBoot] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [moves, setMoves] = React.useState<PMBatchRowState[]>([emptyPmBatchRow()]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/moves/pm-batch");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load partners");
        if (!cancelled) setPartners(data.partners || []);
      } catch (e) {
        if (!cancelled) {
          toast(e instanceof Error ? e.message : "Could not load partners", "x");
        }
      } finally {
        if (!cancelled) setLoadingPartners(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const urlPartnerId = React.useMemo(
    () => searchParams.get("partner_id")?.trim() || "",
    [searchParams],
  );

  React.useEffect(() => {
    if (!urlPartnerId || loadingPartners) return;
    if (!partners.some((p) => p.id === urlPartnerId)) return;
    setPartnerId(urlPartnerId);
    setMoves([emptyPmBatchRow()]);
  }, [urlPartnerId, partners, loadingPartners]);

  const loadBootstrap = React.useCallback(
    async (pid: string) => {
      if (!pid) {
        setBootstrap(null);
        return;
      }
      setLoadingBoot(true);
      try {
        const res = await fetch(`/api/admin/moves/pm-batch?partner_id=${encodeURIComponent(pid)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load partner");
        setBootstrap(data as Bootstrap);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not load buildings", "x");
        setBootstrap(null);
      } finally {
        setLoadingBoot(false);
      }
    },
    [toast],
  );

  React.useEffect(() => {
    void loadBootstrap(partnerId);
  }, [partnerId, loadBootstrap]);

  const updateRow = React.useCallback((idx: number, patch: Partial<PMBatchRowState>) => {
    setMoves((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }, []);

  const removeRow = React.useCallback((idx: number) => {
    setMoves((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  }, []);

  const addRow = React.useCallback(() => {
    setMoves((prev) => [...prev, emptyPmBatchRow()]);
  }, []);

  const summary = React.useMemo(() => {
    const dates = moves.map((m) => m.scheduled_date).filter(Boolean).sort();
    const tenants = new Set(
      moves.map((m) => m.tenant_name.trim().toLowerCase()).filter(Boolean),
    );
    const buildings = new Set(moves.map((m) => m.partner_property_id).filter(Boolean));
    return {
      earliest: dates[0] || "",
      latest: dates[dates.length - 1] || "",
      tenantCount: tenants.size,
      buildingCount: buildings.size,
    };
  }, [moves]);

  const allValid = React.useMemo(() => {
    if (!bootstrap?.contract?.id) return false;
    return moves.every(
      (m) =>
        m.partner_property_id &&
        m.unit_number.trim() &&
        m.reason_code &&
        m.scheduled_date &&
        m.tenant_name.trim(),
    );
  }, [bootstrap, moves]);

  const handleSubmit = async (draft: boolean) => {
    if (!partnerId || !bootstrap?.contract?.id) {
      toast("Select a partner", "x");
      return;
    }
    if (!allValid) {
      toast("Building, unit, tenant, move type, and date are required on each row.", "x");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/moves/pm-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_id: partnerId,
          draft,
          moves: moves.map((m) => ({
            partner_property_id: m.partner_property_id,
            unit_number: m.unit_number.trim(),
            unit_type: m.unit_type,
            reason_code: m.reason_code,
            tenant_name: m.tenant_name.trim(),
            tenant_phone: m.tenant_phone.trim() || undefined,
            tenant_email: m.tenant_email.trim() || undefined,
            scheduled_date: m.scheduled_date,
            holding_unit: m.holding_unit.trim() || undefined,
            packing_required: m.packing_required,
            after_hours: m.after_hours,
            holiday: m.holiday,
            tenant_present: m.tenant_present,
            linked_batch_index:
              m.linked_batch_index === "" || m.linked_batch_index == null
                ? null
                : Number(m.linked_batch_index),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Batch failed");
      toast(
        draft
          ? `Draft saved (${data.move_codes?.length ?? 0} moves)`
          : `Created ${data.move_codes?.length ?? 0} moves`,
        "check",
      );
      router.push("/admin/moves?segment=pm");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Batch failed", "x");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full min-w-0 pb-10">
      <PageHeader
        eyebrow="Partners"
        title="Schedule PM moves"
        description="Create multiple property management moves at once. Pricing follows the partner contract rate card."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => router.push("/admin/partners")}>
              All partners
            </Button>
            <Button variant="secondary" size="sm" onClick={() => router.push("/admin/moves")}>
              All moves
            </Button>
          </div>
        }
      />

      <div>
        <label className="yu3-t-eyebrow text-[var(--yu3-ink-muted)] block mb-2">
          Property management partner
        </label>
        <select
          value={partnerId}
          disabled={loadingPartners}
          onChange={(e) => {
            setPartnerId(e.target.value);
            setMoves([emptyPmBatchRow()]);
          }}
          className="admin-premium-input w-full max-w-lg text-[13px]"
        >
          <option value="">{loadingPartners ? "Loading…" : "Select partner"}</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || p.id}
            </option>
          ))}
        </select>
      </div>

      {partnerId && loadingBoot && (
        <p className="text-[13px] text-[var(--yu3-ink-muted)]">Loading buildings and contract…</p>
      )}

      {bootstrap && bootstrap.contract && (
        <>
          <div className="rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[#FAF7F2] px-4 py-3">
            <p className="yu3-t-eyebrow text-[var(--yu3-ink-muted)] mb-2">Rate preview (local zone sample)</p>
            {bootstrap.rate_preview.length === 0 ? (
              <p className="text-[12px] text-[var(--yu3-ink-muted)]">
                No matrix rows found. Pricing may fall back to legacy contract JSON.
              </p>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--yu3-ink)]">
                {bootstrap.rate_preview.slice(0, 8).map((r, i) => (
                  <span key={`${r.reason_code}-${r.unit_size}-${i}`} className="tabular-nums">
                    {bootstrap.reason_labels[r.reason_code] || r.reason_code} {r.unit_size}:{" "}
                    {formatCurrency(Number(r.base_rate) || 0)}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {moves.map((row, idx) => (
              <PMBatchMoveRow
                key={idx}
                index={idx}
                row={row}
                properties={bootstrap.properties}
                reasonLabels={bootstrap.reason_labels}
                allRows={moves}
                onUpdate={(p) => updateRow(idx, p)}
                onRemove={() => removeRow(idx)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="w-full py-3 rounded-[var(--yu3-r-md)] border border-dashed border-[var(--yu3-line)] text-[13px] text-[var(--yu3-ink-muted)] hover:border-[var(--yu3-wine)]/35 hover:text-[var(--yu3-wine)] transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={18} aria-hidden />
            Add another move
          </button>

          {moves.length > 0 && (
            <div className="rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] p-4 shadow-[var(--yu3-shadow-sm)]">
              <p className="yu3-t-eyebrow text-[var(--yu3-ink-muted)] mb-3">Batch summary</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-semibold text-[var(--yu3-ink-strong)] tabular-nums">
                    {moves.length}
                  </p>
                  <p className="text-[11px] text-[var(--yu3-ink-muted)]">moves</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-[var(--yu3-ink-strong)] tabular-nums">
                    {summary.tenantCount}
                  </p>
                  <p className="text-[11px] text-[var(--yu3-ink-muted)]">tenants</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-[var(--yu3-ink-strong)] tabular-nums">
                    {summary.buildingCount}
                  </p>
                  <p className="text-[11px] text-[var(--yu3-ink-muted)]">buildings</p>
                </div>
                <div>
                  <p className="text-2xl font-semibold text-[var(--yu3-ink-strong)] tabular-nums">
                    ·
                  </p>
                  <p className="text-[11px] text-[var(--yu3-ink-muted)]">priced on save</p>
                </div>
              </div>
              {summary.earliest && summary.latest && (
                <p className="text-[11px] text-[var(--yu3-ink-muted)] text-center mt-3">
                  {formatMoveDate(summary.earliest)} to {formatMoveDate(summary.latest)}
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              className="flex-1 min-w-[160px]"
              disabled={submitting || !allValid}
              onClick={() => void handleSubmit(false)}
            >
              Create {moves.length} moves
            </Button>
            <Button
              variant="secondary"
              disabled={submitting || !allValid}
              onClick={() => void handleSubmit(true)}
            >
              Save as draft
            </Button>
          </div>
        </>
      )}

      {bootstrap && !bootstrap.contract && (
        <p className="text-[13px] text-[var(--yu3-ink-muted)]">
          This partner has no active contract. Add or activate a contract first.
        </p>
      )}
    </div>
  );
}
