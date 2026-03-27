"use client";

import { useState } from "react";
import {
  Invoice,
  CalendarBlank,
  CheckCircle,
  Clock,
  Warning,
  CurrencyDollar,
  Buildings,
  Truck,
  LinkSimple,
} from "@phosphor-icons/react";
import { useToast } from "@/app/admin/components/Toast";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "#9c9489", bg: "rgba(156,148,137,0.12)" },
  sent: { label: "Sent", color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
  viewed: { label: "Viewed", color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  paid: { label: "Paid", color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  partial: { label: "Partial", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  overdue: { label: "Overdue", color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
};

const TERMS_LABELS: Record<string, string> = {
  net_30: "Net 30, monthly, due on statement date",
  net_15: "Net 15, bi-monthly (1st & 16th), due on statement date",
  due_on_delivery: "Due on Receipt, per-delivery, due immediately",
  due_on_receipt: "Due on Receipt, per-delivery, due immediately",
  prepay: "Pre-paid",
};

interface StatementDelivery {
  id: string;
  number: string;
  date: string;
  price: number;
  description: string;
}

interface Statement {
  id: string;
  statement_number: string;
  period_start: string;
  period_end: string;
  deliveries: StatementDelivery[];
  delivery_count: number;
  subtotal: number;
  hst: number;
  total: number;
  due_date: string;
  payment_terms: string;
  status: string;
  paid_amount: number;
  paid_at: string | null;
  sent_at: string | null;
  created_at: string;
  organizations: {
    id: string;
    name: string;
    email: string;
    billing_email?: string;
  } | null;
}

export default function PartnerStatementView({ statement }: { statement: Statement }) {
  const { toast } = useToast();
  const [status, setStatus] = useState(statement.status);
  const [saving, setSaving] = useState(false);

  const org = statement.organizations;
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft!;

  const periodLabel = `${new Date(statement.period_start + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" })}–${new Date(statement.period_end + "T12:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}`;
  const dueDateLabel = new Date(statement.due_date + "T12:00:00").toLocaleDateString("en-CA", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const deliveries: StatementDelivery[] = Array.isArray(statement.deliveries)
    ? statement.deliveries
    : [];

  async function markPaid() {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/partners/${org?.id}/statements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statement_id: statement.id, status: "paid", paid_at: new Date().toISOString(), paid_amount: statement.total }),
      });
      if (res.ok) {
        setStatus("paid");
        toast("Statement marked as paid");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Invoice size={16} color="var(--gold)" />
            <span className="text-[11px] font-bold tracking-widest capitalize text-[var(--gold)]">
              Statement
            </span>
          </div>
          <h1 className="font-hero text-[26px] font-bold text-[var(--tx)]">
            {statement.statement_number}
          </h1>
          {org && (
            <p className="text-[13px] text-[var(--tx3)] mt-1 flex items-center gap-1.5">
              <Buildings size={13} />
              {org.name}
            </p>
          )}
        </div>
        <span
          className="px-3 py-1.5 rounded-full text-[11px] font-bold capitalize tracking-wider"
          style={{ color: statusCfg.color, background: statusCfg.bg }}
        >
          {statusCfg.label}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl p-4 text-center">
          <div className="text-[22px] font-bold text-[var(--gold)]">
            {deliveries.length}
          </div>
          <div className="text-[10px] text-[var(--tx3)] capitalize tracking-wider mt-1">Deliveries</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl p-4 text-center">
          <div className="text-[22px] font-bold text-[var(--tx)]">
            ${Number(statement.subtotal).toFixed(2)}
          </div>
          <div className="text-[10px] text-[var(--tx3)] capitalize tracking-wider mt-1">Subtotal</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl p-4 text-center">
          <div className="text-[22px] font-bold text-[var(--gold)]">
            ${Number(statement.total).toFixed(2)}
          </div>
          <div className="text-[10px] text-[var(--tx3)] capitalize tracking-wider mt-1">Total</div>
        </div>
      </div>

      {/* Details */}
      <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl divide-y divide-[var(--brd)]/30">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[12px] text-[var(--tx3)] flex items-center gap-2">
            <CalendarBlank size={13} /> Period
          </span>
          <span className="text-[13px] font-semibold text-[var(--tx)]">{periodLabel}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[12px] text-[var(--tx3)] flex items-center gap-2">
            <Clock size={13} /> Payment Terms
          </span>
          <span className="text-[13px] font-semibold text-[var(--tx)]">
            {TERMS_LABELS[statement.payment_terms] || statement.payment_terms}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[12px] text-[var(--tx3)] flex items-center gap-2">
            <Warning size={13} /> Due Date
          </span>
          <span className="text-[13px] font-semibold text-[var(--tx)]">{dueDateLabel}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[12px] text-[var(--tx3)] flex items-center gap-2">
            <CurrencyDollar size={13} /> HST (13%)
          </span>
          <span className="text-[13px] text-[var(--tx2)]">${Number(statement.hst).toFixed(2)}</span>
        </div>
      </div>

      {/* Deliveries */}
      {deliveries.length > 0 && (
        <div>
          <h3 className="text-[11px] font-bold tracking-widest capitalize text-[var(--tx3)] mb-3">
            Deliveries ({deliveries.length})
          </h3>
          <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--brd)]/30">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold capitalize tracking-wider text-[var(--tx3)]">
                    Delivery
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold capitalize tracking-wider text-[var(--tx3)]">
                    Date
                  </th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold capitalize tracking-wider text-[var(--tx3)]">
                    Description
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold capitalize tracking-wider text-[var(--tx3)]">
                    Price
                  </th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((d, i) => (
                  <tr
                    key={d.id || i}
                    className="border-b border-[var(--brd)]/20 last:border-0"
                  >
                    <td className="px-4 py-3 text-[12px] font-mono text-[var(--gold)]">
                      {d.number || "-"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[var(--tx3)]">
                      {d.date
                        ? new Date(d.date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[var(--tx2)] max-w-[180px] truncate">
                      {d.description || "-"}
                    </td>
                    <td className="px-4 py-3 text-[13px] font-semibold text-[var(--tx)] text-right">
                      ${Number(d.price || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        {status !== "paid" && (
          <button
            onClick={markPaid}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold text-white transition-all"
            style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)" }}
          >
            <CheckCircle size={14} />
            {saving ? "Saving…" : "Mark as Paid"}
          </button>
        )}
        {/* Shareable pay link for the partner */}
        {status !== "paid" && (
          <button
            onClick={() => {
              const url = `${window.location.origin}/partner/statements/${statement.id}/pay`;
              navigator.clipboard.writeText(url).then(() => toast("Pay link copied to clipboard"));
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
          >
            <LinkSimple size={14} />
            Copy Pay Link
          </button>
        )}
        <a
          href={`/admin/partners/${org?.id}/billing`}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
        >
          <Truck size={14} />
          All Statements
        </a>
      </div>
    </div>
  );
}
