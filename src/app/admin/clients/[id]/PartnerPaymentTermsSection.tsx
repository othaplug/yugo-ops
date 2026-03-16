"use client";

import { useState, useEffect } from "react";
import { useToast } from "../../components/Toast";

type PaymentTermValue = "net_15" | "net_30" | "day_15" | "day_30";

interface PartnerPaymentTermsSectionProps {
  orgId: string;
  orgName: string;
  initialInvoiceDueDays?: number | null;
  initialInvoiceDueDayOfMonth?: number | null;
  onSaved?: () => void;
}

function toValue(days: number | null, dayOfMonth: number | null): PaymentTermValue {
  if (dayOfMonth === 15) return "day_15";
  if (dayOfMonth === 30) return "day_30";
  return days === 15 ? "net_15" : "net_30";
}

export default function PartnerPaymentTermsSection({
  orgId,
  orgName,
  initialInvoiceDueDays = 30,
  initialInvoiceDueDayOfMonth = null,
  onSaved,
}: PartnerPaymentTermsSectionProps) {
  const { toast } = useToast();
  const initialValue = toValue(
    initialInvoiceDueDays === 15 ? 15 : 30,
    initialInvoiceDueDayOfMonth === 15 || initialInvoiceDueDayOfMonth === 30 ? initialInvoiceDueDayOfMonth : null
  );
  const [value, setValue] = useState<PaymentTermValue>(initialValue);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const invoiceDueDays = value === "net_15" || value === "net_30" ? (value === "net_15" ? 15 : 30) : 30;
      const invoiceDueDayOfMonth = value === "day_15" ? 15 : value === "day_30" ? 30 : null;
      const res = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_due_days: invoiceDueDays,
          invoice_due_day_of_month: invoiceDueDayOfMonth,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast("Payment terms updated", "check");
      onSaved?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update", "x");
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = value !== initialValue;

  const termLabels: Record<PaymentTermValue, string> = {
    net_15: "Net 15 (15 days from invoice)",
    net_30: "Net 30 (30 days from invoice)",
    day_15: "15th of month",
    day_30: "30th of month",
  };

  return (
    <div className="border-t border-[var(--brd)]/30 pt-6 pb-6">
      <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Invoice due date</div>
      <p className="text-[11px] text-[var(--tx3)] mb-4">
        When auto-generated delivery invoices are due for {orgName}.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={value}
          onChange={(e) => setValue(e.target.value as PaymentTermValue)}
          className="px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none min-w-[220px]"
        >
          <optgroup label="Days from invoice">
            <option value="net_15">{termLabels.net_15}</option>
            <option value="net_30">{termLabels.net_30}</option>
          </optgroup>
          <optgroup label="Day of month">
            <option value="day_15">{termLabels.day_15}</option>
            <option value="day_30">{termLabels.day_30}</option>
          </optgroup>
        </select>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className="px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
