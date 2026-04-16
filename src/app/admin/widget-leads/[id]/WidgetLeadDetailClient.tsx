"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CaretRight } from "@phosphor-icons/react";
import { formatCurrency } from "@/lib/format-currency";
import { displayLabel } from "@/lib/utils/display-sanitize";

export type WidgetLeadRow = {
  id: string;
  lead_number: string;
  name: string;
  email: string;
  phone: string | null;
  move_size: string;
  from_postal: string;
  to_postal: string;
  move_date: string | null;
  flexible_date: boolean;
  widget_estimate_low: number | null;
  widget_estimate_high: number | null;
  status: string;
  created_at: string;
  estimate_factors?: string[] | null;
  other_items?: { name: string; qty: number }[] | null;
  special_handling?: string | null;
  quote_id?: string | null;
};

type Props = {
  lead: WidgetLeadRow;
  linkedQuoteSlug?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  quote_sent: "Quote sent",
  booked: "Booked",
  lost: "Lost",
};

export default function WidgetLeadDetailClient({
  lead,
  linkedQuoteSlug,
}: Props) {
  const router = useRouter();

  const handleConvert = () => {
    router.push(
      `/admin/quotes/new?widget_request_id=${encodeURIComponent(lead.id)}`,
    );
  };

  return (
    <div className="mx-auto w-full max-w-[900px] px-4 py-8 sm:px-6">
      <div className="mb-8">
        <Link
          href="/admin/widget-leads"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--tx2)] hover:text-[var(--tx)] mb-4"
        >
          <ArrowLeft size={16} weight="bold" aria-hidden />
          Widget leads
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--tx3)]/55">
              {lead.lead_number}
            </p>
            <h1 className="admin-page-hero text-[var(--tx)] mt-1">{lead.name}</h1>
            <p className="text-[13px] text-[var(--tx2)] mt-1">
              {lead.email}
              {lead.phone ? ` · ${lead.phone}` : ""}
            </p>
          </div>
          <span className="inline-flex self-start rounded-lg border border-[var(--brd)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx)]">
            {STATUS_LABELS[lead.status] ?? displayLabel(lead.status)}
          </span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)] mb-3">
            Move details
          </p>
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--tx3)]">Size</dt>
              <dd className="text-[var(--tx)] font-medium text-right">
                {displayLabel(lead.move_size)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--tx3)]">From</dt>
              <dd className="text-[var(--tx)] text-right">
                {lead.from_postal?.toUpperCase() || "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--tx3)]">To</dt>
              <dd className="text-[var(--tx)] text-right">
                {lead.to_postal?.toUpperCase() || "—"}
              </dd>
            </div>
            {lead.move_date && (
              <div className="flex justify-between gap-4">
                <dt className="text-[var(--tx3)]">Move date</dt>
                <dd className="text-[var(--tx)]">{lead.move_date}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--tx3)]">Flexible date</dt>
              <dd className="text-[var(--tx)]">{lead.flexible_date ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)] mb-3">
            Widget estimate
          </p>
          <dl className="space-y-2 text-[13px]">
            <div className="flex justify-between gap-4">
              <dt className="text-[var(--tx3)]">Range</dt>
              <dd className="text-[var(--tx)] font-medium text-right">
                {lead.widget_estimate_low != null &&
                lead.widget_estimate_high != null
                  ? `${formatCurrency(lead.widget_estimate_low)} – ${formatCurrency(lead.widget_estimate_high)}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {lead.special_handling && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)] mb-2">
            Special handling
          </p>
          <p className="text-[13px] text-[var(--tx2)] leading-relaxed whitespace-pre-wrap">
            {lead.special_handling}
          </p>
        </div>
      )}

      {Array.isArray(lead.other_items) && lead.other_items.length > 0 && (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 mb-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--tx3)] mb-3">
            Other items
          </p>
          <ul className="space-y-1 text-[13px]">
            {lead.other_items.map((it, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span className="text-[var(--tx2)]">{it.name}</span>
                <span className="text-[var(--tx)] tabular-nums">×{it.qty}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleConvert}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] [font-family:var(--font-body)] hover:opacity-95"
        >
          Convert to quote
          <CaretRight size={14} weight="bold" aria-hidden />
        </button>
        {linkedQuoteSlug && (
          <Link
            href={`/admin/quotes/${encodeURIComponent(linkedQuoteSlug)}`}
            className="text-[12px] font-medium text-[var(--tx2)] underline underline-offset-2"
          >
            View linked quote
          </Link>
        )}
      </div>
    </div>
  );
}
