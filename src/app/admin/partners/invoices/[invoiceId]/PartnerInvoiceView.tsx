"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Invoice,
  CheckCircle,
  PaperPlaneRight,
  Buildings,
  ArrowLeft,
} from "@phosphor-icons/react";
import { useToast } from "@/app/admin/components/Toast";
import { formatPlatformDisplay } from "@/lib/date-format";
import { useRouter } from "next/navigation";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  draft:   { label: "Draft",   color: "#9c9489" },
  sent:    { label: "Sent",    color: "#60a5fa" },
  paid:    { label: "Paid",    color: "#22c55e" },
  overdue: { label: "Overdue", color: "#ef4444" },
  void:    { label: "Void",    color: "#6b7280" },
};

interface Move {
  id: string;
  move_code: string | null;
  client_name: string | null;
  from_address: string | null;
  to_address: string | null;
  scheduled_date: string | null;
  completed_at: string | null;
  total_price: number | null;
  amount: number | null;
  estimate: number | null;
  move_size: string | null;
}

interface Invoice {
  id: string;
  invoice_number: string;
  organization_id: string;
  status: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  sent_at: string | null;
  paid_at: string | null;
}

interface Org {
  id: string;
  name: string;
  email: string;
  billing_email?: string | null;
}

function fmt(n: number) {
  return `$${Number(n || 0).toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return formatPlatformDisplay(new Date(d + (d.includes("T") ? "" : "T12:00:00")), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function moveRevenue(m: Move): number {
  const tp = m.total_price != null ? Number(m.total_price) : null;
  const am = m.amount != null ? Number(m.amount) : null;
  const es = m.estimate != null ? Number(m.estimate) : null;
  return tp ?? am ?? es ?? 0;
}

export default function PartnerInvoiceView({
  invoice: initialInvoice,
  org,
  moves,
}: {
  invoice: Invoice;
  org: Org;
  moves: Move[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [saving, setSaving] = useState(false);

  const statusCfg = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.draft!;
  const total = moves.reduce((s, m) => s + moveRevenue(m), 0);

  async function updateStatus(newStatus: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/partners/${org.id}/invoices`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoice_id: invoice.id, status: newStatus }),
      });
      if (res.ok) {
        setInvoice((prev) => ({
          ...prev,
          status: newStatus,
          sent_at: newStatus === "sent" ? new Date().toISOString() : prev.sent_at,
          paid_at: newStatus === "paid" ? new Date().toISOString() : prev.paid_at,
        }));
        toast(newStatus === "paid" ? "Marked as paid" : `Status → ${newStatus}`);
      } else {
        const d = await res.json();
        toast(d.error || "Failed to update");
      }
    } catch {
      toast("Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href={`/admin/partners/${org.id}/billing`}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[var(--tx3)] hover:text-[var(--tx)] transition-colors"
      >
        <ArrowLeft size={12} />
        Back to {org.name} billing
      </Link>

      {/* Header */}
      <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Invoice size={16} className="text-[var(--tx3)]" />
              <span className="text-[11px] font-bold tracking-widest uppercase text-[var(--accent-text)]">
                Invoice
              </span>
            </div>
            <h1 className="text-[24px] font-bold text-[var(--tx)] font-mono">
              {invoice.invoice_number}
            </h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span
                className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{ color: statusCfg.color, background: `${statusCfg.color}1a` }}
              >
                {statusCfg.label}
              </span>
              <span className="text-[12px] text-[var(--tx3)]">
                {fmtDate(invoice.period_start)} – {fmtDate(invoice.period_end)}
              </span>
            </div>
          </div>

          <div className="text-right">
            <div className="text-[11px] text-[var(--tx3)] uppercase tracking-wider mb-1">Total</div>
            <div className="text-[28px] font-bold text-[var(--tx)]">{fmt(total)}</div>
            <div className="text-[11px] text-[var(--tx3)] mt-1">
              {moves.length} move{moves.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Org info */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[var(--brd)]/30">
          <Buildings size={13} className="text-[var(--tx3)]" />
          <span className="text-[12px] text-[var(--tx3)]">{org.name}</span>
          <span className="text-[var(--tx3)]">·</span>
          <span className="text-[12px] text-[var(--tx3)]">{org.billing_email || org.email}</span>
        </div>

        {invoice.notes && (
          <p className="mt-3 text-[12px] text-[var(--tx3)] italic">{invoice.notes}</p>
        )}

        {/* Actions */}
        {!["paid", "void"].includes(invoice.status) && (
          <div className="flex items-center gap-3 mt-5 pt-4 border-t border-[var(--brd)]/30">
            {invoice.status === "draft" && (
              <button
                onClick={() => updateStatus("sent")}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold border border-[#60a5fa]/30 text-[#60a5fa] hover:bg-[#60a5fa]/10 transition-all disabled:opacity-50"
              >
                <PaperPlaneRight size={13} />
                Mark as Sent
              </button>
            )}
            {["draft", "sent", "overdue"].includes(invoice.status) && (
              <button
                onClick={() => updateStatus("paid")}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold border border-[#22c55e]/30 text-[#22c55e] hover:bg-[#22c55e]/10 transition-all disabled:opacity-50"
              >
                <CheckCircle size={13} />
                Mark as Paid
              </button>
            )}
            {["draft", "sent"].includes(invoice.status) && (
              <button
                onClick={() => updateStatus("void")}
                disabled={saving}
                className="ml-auto text-[11px] text-[var(--tx3)] hover:text-red-400 transition-colors"
              >
                Void invoice
              </button>
            )}
          </div>
        )}
      </div>

      {/* Move line items */}
      <div>
        <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-3">
          Moves ({moves.length})
        </h2>

        {moves.length === 0 ? (
          <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-2xl p-8 text-center">
            <p className="text-[13px] text-[var(--tx3)]">No moves linked to this invoice</p>
          </div>
        ) : (
          <div className="bg-[var(--card)] border border-[var(--brd)]/40 rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--brd)]/30">
                  {["Job", "Client", "Date", "Route", "Amount"].map((h) => (
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
                {moves.map((m, i) => {
                  const rev = moveRevenue(m);
                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-[var(--brd)]/20 last:border-0 hover:bg-[var(--brd)]/5 transition-colors ${i % 2 === 1 ? "bg-[var(--brd)]/3" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/moves/${m.id}`}
                          className="text-[12px] font-mono font-semibold text-[var(--accent-text)] hover:underline"
                        >
                          {m.move_code || m.id.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[var(--tx)]">
                        {m.client_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-[var(--tx3)] whitespace-nowrap">
                        {m.scheduled_date ? fmtDate(m.scheduled_date) : fmtDate(m.completed_at)}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-[var(--tx3)] max-w-[200px]">
                        {m.from_address && m.to_address ? (
                          <span className="line-clamp-2">
                            {extractCity(m.from_address)} → {extractCity(m.to_address)}
                          </span>
                        ) : (
                          m.from_address || "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-bold text-[var(--tx)]">
                        {rev > 0 ? fmt(rev) : <span className="text-[var(--tx3)] font-normal">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--brd)]/40 bg-[var(--brd)]/5">
                  <td colSpan={4} className="px-4 py-3 text-[12px] font-bold text-[var(--tx3)] uppercase tracking-wider">
                    Total
                  </td>
                  <td className="px-4 py-3 text-[15px] font-bold text-[var(--tx)]">
                    {fmt(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="text-[11px] text-[var(--tx3)] space-y-1">
        <div>Created: {fmtDate(invoice.created_at)}</div>
        {invoice.sent_at && <div>Sent: {fmtDate(invoice.sent_at)}</div>}
        {invoice.paid_at && <div>Paid: {fmtDate(invoice.paid_at)}</div>}
      </div>
    </div>
  );
}

function extractCity(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return parts[parts.length - 2].replace(/\s+[A-Z]{2}\s*$/, "").trim();
  return parts[0] || address;
}
