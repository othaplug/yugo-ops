"use client";

import * as React from "react";
import { Button } from "@/design-system/admin/primitives";

export type PMBatchRowState = {
  partner_property_id: string;
  unit_number: string;
  unit_type: string;
  reason_code: string;
  tenant_name: string;
  tenant_phone: string;
  tenant_email: string;
  scheduled_date: string;
  holding_unit: string;
  packing_required: boolean;
  after_hours: boolean;
  holiday: boolean;
  tenant_present: boolean;
  linked_batch_index: string;
  show_tenant_contact: boolean;
};

export function emptyPmBatchRow(): PMBatchRowState {
  return {
    partner_property_id: "",
    unit_number: "",
    unit_type: "2br",
    reason_code: "reno_move_out",
    tenant_name: "",
    tenant_phone: "",
    tenant_email: "",
    scheduled_date: "",
    holding_unit: "",
    packing_required: false,
    after_hours: false,
    holiday: false,
    tenant_present: true,
    linked_batch_index: "",
    show_tenant_contact: false,
  };
}

const UNIT_TYPES: { value: string; label: string }[] = [
  { value: "studio", label: "Studio" },
  { value: "1br", label: "1 BR" },
  { value: "2br", label: "2 BR" },
  { value: "3br", label: "3 BR" },
  { value: "4br_plus", label: "4+ BR" },
];

const REASON_FALLBACK: { value: string; label: string }[] = [
  { value: "tenant_move_out", label: "Tenant move-out" },
  { value: "tenant_move_in", label: "Tenant move-in" },
  { value: "reno_move_out", label: "Renovation move-out" },
  { value: "reno_move_in", label: "Renovation move-in" },
  { value: "reno_bundle", label: "Renovation bundle" },
  { value: "suite_transfer", label: "Suite transfer" },
  { value: "unit_turnover", label: "Unit turnover" },
  { value: "emergency_relocation", label: "Emergency relocation" },
  { value: "staging", label: "Staging" },
];

type Prop = {
  index: number;
  row: PMBatchRowState;
  properties: { id: string; building_name: string; address: string }[];
  reasonLabels: Record<string, string>;
  allRows: PMBatchRowState[];
  onUpdate: (patch: Partial<PMBatchRowState>) => void;
  onRemove: () => void;
};

export function PMBatchMoveRow({
  index,
  row,
  properties,
  reasonLabels,
  allRows,
  onUpdate,
  onRemove,
}: Prop) {
  const reasonOptions = React.useMemo(() => {
    const fromLabels = Object.keys(reasonLabels || {}).sort();
    const set = new Set(fromLabels.length ? fromLabels : REASON_FALLBACK.map((r) => r.value));
    return Array.from(set).map((value) => ({
      value,
      label: reasonLabels[value] || REASON_FALLBACK.find((r) => r.value === value)?.label || value,
    }));
  }, [reasonLabels]);

  const linkChoices = React.useMemo(() => {
    return allRows.map((_, i) => i).filter((i) => i !== index);
  }, [allRows, index]);

  return (
    <div className="rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] p-4 md:p-5 shadow-[var(--yu3-shadow-sm)]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 w-8 h-8 rounded-full bg-[var(--yu3-wine-wash)] flex items-center justify-center text-[11px] font-bold text-[var(--yu3-wine)] tabular-nums ring-1 ring-[color-mix(in_srgb,var(--yu3-wine)_18%,transparent)]">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">Move row</p>
            <p className="text-[15px] font-semibold text-[var(--yu3-ink-strong)] truncate mt-0.5">
              {row.tenant_name.trim() || "New move"}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          uppercase
          className="shrink-0 text-[var(--yu3-danger)] hover:text-[var(--yu3-danger)] hover:bg-[var(--yu3-danger-tint)]"
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <label className="block min-w-0">
          <span className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">Building</span>
          <select
            value={row.partner_property_id}
            onChange={(e) => onUpdate({ partner_property_id: e.target.value })}
            className="mt-1.5 admin-premium-input w-full text-[13px] font-normal normal-case tracking-normal"
          >
            <option value="">Select building</option>
            {properties.map((b) => (
              <option key={b.id} value={b.id}>
                {b.building_name}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">Unit</span>
          <input
            value={row.unit_number}
            onChange={(e) => onUpdate({ unit_number: e.target.value })}
            placeholder="e.g. 1304"
            className="mt-1.5 admin-premium-input w-full text-[13px] font-normal normal-case tracking-normal"
          />
        </label>
        <label className="block min-w-0">
          <span className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">Size</span>
          <select
            value={row.unit_type}
            onChange={(e) => onUpdate({ unit_type: e.target.value })}
            className="mt-1.5 admin-premium-input w-full text-[13px] font-normal normal-case tracking-normal"
          >
            {UNIT_TYPES.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block min-w-0">
          <span className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">Move type</span>
          <select
            value={row.reason_code}
            onChange={(e) => onUpdate({ reason_code: e.target.value })}
            className="mt-1.5 admin-premium-input w-full text-[13px] font-normal normal-case tracking-normal"
          >
            {reasonOptions.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mt-4">
        <label className="block min-w-0">
          <span className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">Service date</span>
          <input
            type="date"
            value={row.scheduled_date}
            onChange={(e) => onUpdate({ scheduled_date: e.target.value })}
            className="mt-1.5 admin-premium-input w-full text-[13px] font-normal normal-case tracking-normal"
          />
        </label>
        <label className="block min-w-0">
          <span className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">Holding unit / notes</span>
          <input
            value={row.holding_unit}
            onChange={(e) => onUpdate({ holding_unit: e.target.value })}
            placeholder="e.g. 1294 WL"
            className="mt-1.5 admin-premium-input w-full text-[13px] font-normal normal-case tracking-normal"
          />
        </label>
        <label className="block min-w-0 lg:col-span-2">
          <span className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">Tenant</span>
          <input
            value={row.tenant_name}
            onChange={(e) => onUpdate({ tenant_name: e.target.value })}
            placeholder="Tenant name"
            className="mt-1.5 admin-premium-input w-full text-[13px] font-normal normal-case tracking-normal"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 px-3 py-3 rounded-[var(--yu3-r-md)] bg-[var(--yu3-bg-surface-sunken)] border border-[var(--yu3-line-subtle)]">
        <label className="inline-flex items-center gap-2 text-[12px] text-[var(--yu3-ink)] cursor-pointer">
          <input
            type="checkbox"
            checked={row.packing_required}
            onChange={(e) => onUpdate({ packing_required: e.target.checked })}
            className="rounded border-[var(--yu3-line)]"
          />
          Packing required
        </label>
        <label className="inline-flex items-center gap-2 text-[12px] text-[var(--yu3-ink)] cursor-pointer">
          <input
            type="checkbox"
            checked={row.after_hours}
            onChange={(e) => onUpdate({ after_hours: e.target.checked })}
            className="rounded border-[var(--yu3-line)]"
          />
          After hours
        </label>
        <label className="inline-flex items-center gap-2 text-[12px] text-[var(--yu3-ink)] cursor-pointer">
          <input
            type="checkbox"
            checked={row.holiday}
            onChange={(e) => onUpdate({ holiday: e.target.checked })}
            className="rounded border-[var(--yu3-line)]"
          />
          Holiday
        </label>
        <label className="inline-flex items-center gap-2 text-[12px] text-[var(--yu3-ink)] cursor-pointer">
          <input
            type="checkbox"
            checked={row.tenant_present}
            onChange={(e) => onUpdate({ tenant_present: e.target.checked })}
            className="rounded border-[var(--yu3-line)]"
          />
          Tenant on site for walkthrough
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4">
        <label className="flex flex-wrap items-center gap-2 text-[12px] text-[var(--yu3-ink)]">
          <span className="yu3-t-eyebrow text-[var(--yu3-ink-muted)] shrink-0">Link to row</span>
          <select
            value={row.linked_batch_index}
            onChange={(e) => onUpdate({ linked_batch_index: e.target.value })}
            className="admin-premium-input text-[12px] py-2 font-normal normal-case tracking-normal min-w-[8rem]"
          >
            <option value="">None</option>
            {linkChoices.map((i) => (
              <option key={i} value={String(i)}>
                Row {i + 1}
                {allRows[i]?.tenant_name ? ` · ${allRows[i]!.tenant_name}` : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => onUpdate({ show_tenant_contact: !row.show_tenant_contact })}
          className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-wine)] hover:underline"
        >
          {row.show_tenant_contact ? "Hide" : "Add"} tenant contact
        </button>
      </div>

      {row.show_tenant_contact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mt-4 p-4 rounded-[var(--yu3-r-md)] bg-[var(--yu3-bg-surface-sunken)] border border-[var(--yu3-line-subtle)]">
          <label className="block min-w-0">
            <span className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">Tenant phone</span>
            <input
              value={row.tenant_phone}
              onChange={(e) => onUpdate({ tenant_phone: e.target.value })}
              placeholder="(416) 555-0100"
              className="mt-1.5 admin-premium-input w-full text-[13px] font-normal normal-case tracking-normal"
            />
          </label>
          <label className="block min-w-0">
            <span className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">Tenant email</span>
            <input
              type="email"
              value={row.tenant_email}
              onChange={(e) => onUpdate({ tenant_email: e.target.value })}
              placeholder="tenant@email.com"
              className="mt-1.5 admin-premium-input w-full text-[13px] font-normal normal-case tracking-normal"
            />
          </label>
        </div>
      )}
    </div>
  );
}
