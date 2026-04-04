"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Invoice,
  Warning,
  CheckCircle,
  ArrowRight,
  CurrencyDollar,
  PlusCircle,
  CircleNotch,
} from "@phosphor-icons/react";
import { useToast } from "@/app/admin/components/Toast";
import { ordinalDay } from "@/lib/ordinal";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft:   { label: "Draft",   color: "#9c9489", bg: "rgba(156,148,137,0.12)" },
  sent:    { label: "Sent",    color: "#60a5fa", bg: "rgba(96,165,250,0.12)"  },
  viewed:  { label: "Viewed",  color: "#a78bfa", bg: "rgba(167,139,250,0.12)" },
  paid:    { label: "Paid",    color: "#22c55e", bg: "rgba(34,197,94,0.12)"   },
  partial: { label: "Partial", color: "#f59e0b", bg: "rgba(245,158,11,0.12)"  },
  overdue: { label: "Overdue", color: "#ef4444", bg: "rgba(239,68,68,0.12)"   },
};

const TERMS_LABELS: Record<string, string> = {
  net_30: "Net 30, monthly statement, due on statement date",
  net_15: "Net 15, bi-monthly (1st & 16th), due on statement date",
  due_on_delivery: "Due on Receipt, per-delivery, due immediately",
  due_on_receipt:  "Due on Receipt, per-delivery, due immediately",
  prepay: "Pre-paid, credit balance",
};

interface Statement {
  id: string;
  statement_number: string;
  period_start: string;
  period_end: string;
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
}

interface Org {
  id: string;
  name: string;
  email: string;
  billing_email?: string;
  payment_terms?: string;
  billing_anchor_day?: number;
  billing_method?: string;
}

interface Aging {
  current: number;
  days30: number;
  days60: number;
  days90: number;
}

function fmt(n: number) {
  return `$${Number(n).toFixed(2)}`;
}

function fmtDate(d: string) {
  return new Date(d + "T12:00:00").toLocaleDateString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function periodLabel(s: Statement) {
  return `${fmtDate(s.period_start)} – ${fmtDate(s.period_end)}`;
}

interface GenerateForm {
  periodStart: string;
  periodEnd: string;
}

export default function PartnerBillingAdmin({
  org,
  statements: initialStatements,
  aging,
}: {
  org: Org;
  statements: Statement[];
  aging: Aging;
}) {
  const { toast } = useToast();
  const [statements, setStatements] = useState<Statement[]>(initialStatements);
  const [generating, setGenerating] = useState(false);
  const [showGenForm, setShowGenForm] = useState(false);
  const [form, setForm] = useState<GenerateForm>(() => {
    const end = new Date();
    end.setDate(end.getDate() - 1);
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    return {
      periodStart: start.toISOString().slice(0, 10),
      periodEnd: end.toISOString().slice(0, 10),
    };
  });

  const totalOutstanding = aging.current + aging.days30 + aging.days60 + aging.days90;

  async function generateStatement() {
    setGenerating(true);
    try {
      const res = await fetch(`/api/admin/partners/${org.id}/statements`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_start: form.periodStart,
          period_end: form.periodEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to generate statement");
        return;
      }
      toast("Statement generated successfully");
      setStatements((prev) => [data.statement, ...prev]);
      setShowGenForm(false);
    } catch {
      toast("Failed to generate statement");
    } finally {
      setGenerating(false);
    }
  }

  async function markPaid(stmtId: string) {
    try {
      const res = await fetch(`/api/admin/partners/${org.id}/statements`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          statement_id: stmtId,
          status: "paid",
          paid_at: new Date().toISOString(),
          paid_amount: statements.find((s) => s.id === stmtId)?.total ?? 0,
        }),
      });
      if (res.ok) {
        setStatements((prev) =>
          prev.map((s) =>
            s.id === stmtId ? { ...s, status: "paid", paid_at: new Date().toISOString() } : s
          )
        );
        toast("Marked as paid");
      }
    } catch {
      toast("Failed to update");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-bold tracking-widest uppercase text-[var(--gold)]">
              Billing Overview
            </span>
          </div>
          <h1 className="admin-page-hero text-[var(--tx)]">
            {org.name}
          </h1>
          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            <span className="text-[12px] text-[var(--tx3)]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)]/50 mr-1">Terms</span>
              {TERMS_LABELS[org.payment_terms ?? "net_30"] ?? org.payment_terms}
            </span>
            {org.billing_anchor_day && org.payment_terms !== "due_on_receipt" && org.payment_terms !== "due_on_delivery" && (
              <span className="text-[12px] text-[var(--tx3)]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)]/50 mr-1">Cycle</span>
                {org.payment_terms === "net_15"
                  ? "1st & 16th of month"
                  : <>{ordinalDay(org.billing_anchor_day)} of month</>}
              </span>
            )}
            <span className="text-[12px] text-[var(--tx3)]">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)]/50 mr-1">Billing email</span>
              {org.billing_email || org.email}
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowGenForm((v) => !v)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold border border-[var(--gold)]/30 text-[var(--gold)] hover:bg-[var(--gold)]/8 transition-all"
        >
          <PlusCircle size={15} />
          Generate Statement
        </button>
      </div>

      {/* Generate form */}
      {showGenForm && (
        <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-2xl p-5 space-y-4">
          <h3 className="text-[13px] font-bold text-[var(--tx)]">Generate Statement Now</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1.5">
                Period Start
              </label>
              <input
                type="date"
                value={form.periodStart}
                onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)]/60 rounded-xl text-[13px] text-[var(--tx)] outline-none focus:border-[var(--gold)]/50"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-1.5">
                Period End
              </label>
              <input
                type="date"
                value={form.periodEnd}
                onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
                className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)]/60 rounded-xl text-[13px] text-[var(--tx)] outline-none focus:border-[var(--gold)]/50"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={generateStatement}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold text-white transition-all disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, #2C3E2D, #8B7332)" }}
            >
              {generating ? <CircleNotch size={14} className="animate-spin" /> : <Invoice size={14} />}
              {generating ? "Generating…" : "Generate"}
            </button>
            <button
              onClick={() => setShowGenForm(false)}
              className="px-4 py-2.5 rounded-xl text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--tx)] transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Aging summary */}
      {totalOutstanding > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Current", value: aging.current, color: "#22c55e" },
            { label: "1–30 Days", value: aging.days30, color: "#f59e0b" },
            { label: "31–60 Days", value: aging.days60, color: "#f97316" },
            { label: "60+ Days", value: aging.days90, color: "#ef4444" },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-xl p-4 text-center"
            >
              <div className="text-[18px] font-bold" style={{ color: value > 0 ? color : "var(--tx3)" }}>
                {fmt(value)}
              </div>
              <div className="text-[10px] text-[var(--tx3)] uppercase tracking-wider mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Statements table */}
      <div>
        <h2 className="admin-section-h2 text-[var(--tx2)] mb-3">
          Statements ({statements.length})
        </h2>

        {statements.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-2xl p-8 text-center">
            <Invoice size={28} className="mx-auto mb-3 text-[var(--tx3)]" />
            <p className="text-[13px] font-semibold text-[var(--tx)]">No statements yet</p>
            <p className="text-[12px] text-[var(--tx3)] mt-1">
              Statements are generated automatically on the anchor date. Due date = statement date (billing cycle is the payment window).
            </p>
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--brd)]/30">
                  {["Statement", "Period", "Deliveries", "Total", "Due", "Status", ""].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {statements.map((s) => {
                  const cfg = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.draft!;
                  const isOverdue = s.status === "overdue";
                  const canMarkPaid = !["paid", "draft"].includes(s.status);
                  return (
                    <tr
                      key={s.id}
                      className="border-b border-[var(--brd)]/20 last:border-0 hover:bg-[var(--brd)]/5 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/partners/statements/${s.id}`}
                          className="text-[12px] font-mono font-semibold text-[var(--gold)] hover:underline"
                        >
                          {s.statement_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[var(--tx3)]">{periodLabel(s)}</td>
                      <td className="px-4 py-3 text-[12px] text-[var(--tx)] text-center">
                        {s.delivery_count}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-bold text-[var(--tx)]">
                        {fmt(s.total)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-[12px] font-semibold ${isOverdue ? "text-[#ef4444]" : "text-[var(--tx3)]"}`}
                        >
                          {fmtDate(s.due_date)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                          style={{ color: cfg.color, background: cfg.bg }}
                        >
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/partners/statements/${s.id}`}
                            className="flex items-center gap-1 text-[11px] text-[var(--tx3)] hover:text-[var(--gold)] transition-colors"
                          >
                            <ArrowRight size={12} />
                            View
                          </Link>
                          {canMarkPaid && (
                            <button
                              onClick={() => markPaid(s.id)}
                              className="flex items-center gap-1 text-[11px] text-[#22c55e] hover:opacity-80 transition-opacity"
                            >
                              <CheckCircle size={12} />
                              Paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
