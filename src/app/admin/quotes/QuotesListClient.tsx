"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format-currency";
import { toTitleCase } from "@/lib/format-text";
import { Trash2 } from "lucide-react";

interface Quote {
  id: string;
  quote_id: string;
  contact_id: string;
  client_name: string;
  service_type: string;
  status: string;
  tiers: unknown;
  custom_price: number | null;
  from_address?: string;
  to_address?: string;
  move_date?: string;
  sent_at: string | null;
  viewed_at: string | null;
  accepted_at: string | null;
  expires_at: string | null;
  created_at: string;
}

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "accepted", label: "Accepted" },
  { value: "expired", label: "Expired" },
  { value: "declined", label: "Declined" },
];

function statusBadge(status: string): string {
  switch (status) {
    case "sent": return "bg-[var(--gold)]/15 text-[var(--gold)]";
    case "viewed": return "bg-[#3B82F6]/15 text-[#3B82F6]";
    case "accepted": return "bg-[var(--grn)]/15 text-[var(--grn)]";
    case "expired": case "declined": return "bg-[var(--red)]/15 text-[var(--red)]";
    default: return "bg-[var(--brd)] text-[var(--tx3)]";
  }
}

function serviceLabel(st: string): string {
  const map: Record<string, string> = {
    local_move: "Residential", long_distance: "Long Distance", office_move: "Office",
    single_item: "Single Item", white_glove: "White Glove", specialty: "Specialty", b2b_delivery: "B2B",
  };
  return map[st] || st;
}

function quoteAmount(q: Quote): string {
  if (q.custom_price) return formatCurrency(q.custom_price);
  if (q.tiers && typeof q.tiers === "object") {
    const tiers = q.tiers as Record<string, { total?: number }>;
    const first = Object.values(tiers).find((t) => t?.total);
    if (first?.total) return formatCurrency(first.total);
  }
  return "—";
}

function relTime(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

function expiryInfo(expiresAt: string | null, status: string): { label: string; className: string } | null {
  if (!expiresAt || status === "accepted") return null;
  const daysLeft = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (daysLeft <= 0) return { label: "Expired", className: "text-[var(--red)]" };
  if (daysLeft <= 2) return { label: `Expires in ${daysLeft}d`, className: "text-[var(--red)]" };
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, className: "text-[var(--tx3)]" };
  return null;
}

export default function QuotesListClient({ quotes }: { quotes: Quote[] }) {
  const [filter, setFilter] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const router = useRouter();

  const filtered = useMemo(
    () => (filter ? quotes.filter((q) => q.status === filter) : quotes),
    [quotes, filter],
  );

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/quotes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Failed to delete");
      } else {
        router.refresh();
      }
    } catch {
      alert("Failed to delete quote");
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  }, [router]);

  return (
    <div className="max-w-[1000px] mx-auto px-3 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 animate-fade-up min-w-0">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">Quotes</h1>
          <p className="text-[12px] text-[var(--tx3)] mt-0.5">All proposals & pricing</p>
        </div>
        <Link
          href="/admin/quotes/new"
          className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors whitespace-nowrap"
        >
          + New Quote
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5">
        {STATUS_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setFilter(o.value)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-colors ${
              filter === o.value
                ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]"
                : "border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--tx2)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="divide-y divide-[var(--brd)]/50">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center text-[12px] text-[var(--tx3)]">
              No quotes yet
            </div>
          ) : (
            filtered.map((q) => {
              const expiry = expiryInfo(q.expires_at, q.status);
              const isDraft = q.status === "draft";
              return (
                <div
                  key={q.id}
                  className="flex items-center gap-0 hover:bg-[var(--bg)]/30 transition-colors"
                >
                  <Link
                    href={`/admin/quotes/${q.quote_id || q.id}`}
                    className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3.5"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono text-[var(--tx3)]">{q.quote_id}</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${statusBadge(q.status)}`}>
                          {toTitleCase(q.status)}
                        </span>
                        {expiry && (
                          <span className={`text-[9px] font-semibold ${expiry.className}`}>{expiry.label}</span>
                        )}
                      </div>
                      <div className="text-[13px] font-bold text-[var(--tx)] mt-0.5 truncate">{q.client_name || "—"}</div>
                      <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                        {serviceLabel(q.service_type)} · {relTime(q.sent_at || q.created_at)}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[14px] font-bold text-[var(--gold)] font-heading">{quoteAmount(q)}</div>
                    </div>
                  </Link>
                  {isDraft && (
                    <div className="shrink-0 pr-3">
                      {confirmId === q.id ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleDelete(q.id)}
                            disabled={deleting === q.id}
                            className="px-2 py-1 rounded text-[9px] font-bold bg-[var(--red)]/15 text-[var(--red)] hover:bg-[var(--red)]/25 transition-colors disabled:opacity-50"
                          >
                            {deleting === q.id ? "…" : "Delete"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            className="px-2 py-1 rounded text-[9px] font-medium text-[var(--tx3)] hover:text-[var(--tx)] transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmId(q.id)}
                          title="Delete draft"
                          className="p-1.5 rounded-lg text-[var(--tx3)] hover:text-[var(--red)] hover:bg-[var(--red)]/10 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
