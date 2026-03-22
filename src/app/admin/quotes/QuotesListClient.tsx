"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/format-currency";
import { toTitleCase } from "@/lib/format-text";
import { Plus, Trash as Trash2 } from "@phosphor-icons/react";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";
import CreateButton from "../components/CreateButton";
import { useToast } from "../components/Toast";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";

interface Quote {
  id: string;
  quote_id: string;
  contact_id: string;
  client_name: string;
  service_type: string;
  status: string;
  tiers: unknown;
  custom_price: number | null;
  recommended_tier: string | null;
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
    case "viewed": return "bg-[#3B82F6]/15 text-blue-700 dark:text-sky-300 ring-1 ring-inset ring-[#3B82F6]/25";
    case "accepted": return "bg-[var(--grn)]/15 text-[var(--grn)]";
    case "expired": case "declined": return "bg-[var(--red)]/15 text-[var(--red)]";
    default: return "bg-[var(--brd)] text-[var(--tx3)]";
  }
}

function serviceLabel(st: string): string {
  const map: Record<string, string> = {
    local_move: "Residential", long_distance: "Long Distance", office_move: "Office",
    single_item: "Single Item", white_glove: "White Glove", specialty: "Specialty",
    event: "Event", b2b_delivery: "B2B", labour_only: "Labour Only",
  };
  return map[st] || st;
}

function quoteAmountRaw(q: Quote): number | null {
  if (q.custom_price) return q.custom_price;
  if (q.tiers && typeof q.tiers === "object") {
    const tiers = q.tiers as Record<string, { total?: number }>;
    const recKey = (q.recommended_tier ?? "signature").toString().toLowerCase().trim();
    const recommended = tiers[recKey]?.total;
    if (recommended != null) return recommended;
    const first = Object.values(tiers).find((t) => t?.total);
    if (first?.total) return first.total;
  }
  return null;
}

function quoteAmount(q: Quote): string {
  const raw = quoteAmountRaw(q);
  return raw != null ? formatCurrency(raw) : "—";
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
  const [followupModalOpen, setFollowupModalOpen] = useState(false);
  const [followupPreview, setFollowupPreview] = useState<{ quote_id: string; stage: 1 | 2 | 3 }[]>([]);
  const [followupLoading, setFollowupLoading] = useState(false);
  const [followupSending, setFollowupSending] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

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

  const openDueFollowupsModal = useCallback(async () => {
    setFollowupLoading(true);
    try {
      const res = await fetch("/api/admin/quotes/due-followups-preview", { credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(typeof data.error === "string" ? data.error : "Could not load preview", "x");
        return;
      }
      setFollowupPreview(Array.isArray(data.items) ? data.items : []);
      setFollowupModalOpen(true);
    } catch {
      toast("Could not load preview", "x");
    } finally {
      setFollowupLoading(false);
    }
  }, [toast]);

  const confirmSendDueFollowups = useCallback(async () => {
    setFollowupSending(true);
    try {
      const res = await fetch("/api/admin/quotes/send-due-followups", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(typeof data.error === "string" ? data.error : "Send failed", "x");
        return;
      }
      const n = typeof data.emailsSent === "number" ? data.emailsSent : 0;
      toast(`${n} follow-up emails sent.`, "check");
      setFollowupModalOpen(false);
      setFollowupPreview([]);
      router.refresh();
    } catch {
      toast("Send failed", "x");
    } finally {
      setFollowupSending(false);
    }
  }, [router, toast]);

  const columns: ColumnDef<Quote>[] = useMemo(
    () => [
      {
        id: "quote_id",
        label: "Quote ID",
        accessor: (q) => q.quote_id,
        searchable: true,
        exportAccessor: (q) => q.quote_id ?? "",
      },
      {
        id: "client",
        label: "Client",
        accessor: (q) => q.client_name,
        searchable: true,
        render: (q) => (
          <span className="font-bold text-[var(--tx)] truncate block">
            {q.client_name || "Unnamed Client"}
          </span>
        ),
        exportAccessor: (q) => q.client_name ?? "",
      },
      {
        id: "service",
        label: "Service",
        accessor: (q) => q.service_type,
        render: (q) => serviceLabel(q.service_type),
        exportAccessor: (q) => serviceLabel(q.service_type),
      },
      {
        id: "status",
        label: "Status",
        accessor: (q) => q.status,
        render: (q) => {
          const expiry = expiryInfo(q.expires_at, q.status);
          return (
            <span className="inline-flex items-center gap-1.5 flex-wrap">
              <span
                className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide ${statusBadge(q.status)}`}
              >
                {toTitleCase(q.status)}
              </span>
              {expiry && (
                <span className={`text-[9px] font-semibold ${expiry.className}`}>
                  {expiry.label}
                </span>
              )}
            </span>
          );
        },
        exportAccessor: (q) => toTitleCase(q.status),
      },
      {
        id: "sent_created",
        label: "Sent/Created",
        accessor: (q) => q.sent_at || q.created_at,
        render: (q) => relTime(q.sent_at || q.created_at),
        exportAccessor: (q) => relTime(q.sent_at || q.created_at),
      },
      {
        id: "amount",
        label: "Amount",
        accessor: (q) => quoteAmount(q),
        align: "right",
        minWidth: "92px",
        render: (q) => (
          <span className="block text-right font-bold text-[var(--gold)] font-heading">
            {quoteAmount(q)}
          </span>
        ),
        exportAccessor: (q) => quoteAmount(q),
      },
      {
        id: "actions",
        label: "Actions",
        accessor: () => "",
        sortable: false,
        searchable: false,
        align: "right",
        minWidth: "80px",
        render: (q) => {
          const isDraft = q.status === "draft";
          if (!isDraft) return null;
          return (
            <div
              className="flex items-center justify-end gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              {confirmId === q.id ? (
                <div className="flex flex-col items-end gap-1.5 max-w-[7.5rem]">
                  <button
                    type="button"
                    onClick={() => handleDelete(q.id)}
                    disabled={deleting === q.id}
                    className="w-full min-h-[36px] px-3 rounded-full text-[10px] font-bold bg-[var(--red)]/15 text-[var(--red)] border border-[var(--red)]/25 hover:bg-[var(--red)]/25 transition-colors disabled:opacity-50"
                  >
                    {deleting === q.id ? "…" : "Delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmId(null)}
                    className="w-full min-h-[32px] px-2 rounded-full text-[10px] font-medium text-[#5C5449] dark:text-[#C9C4B8] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmId(q.id)}
                  title="Delete draft"
                  className="inline-flex items-center justify-center min-h-[40px] min-w-[40px] rounded-full text-[#5C5449] dark:text-[#C9C4B8] hover:text-[var(--red)] hover:bg-[var(--red)]/10 transition-colors border border-transparent hover:border-[var(--red)]/20"
                >
                  <Trash2 className="w-[18px] h-[18px]" />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [confirmId, deleting, handleDelete],
  );

  const sentCount = quotes.filter((q) => q.status === "sent").length;
  const acceptedCount = quotes.filter((q) => q.status === "accepted").length;
  const viewedCount = quotes.filter((q) => q.status === "viewed").length;
  const totalValue = quotes.reduce((s, q) => s + (quoteAmountRaw(q) ?? 0), 0);

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-5 md:px-6 py-4 sm:py-5 md:py-6 animate-fade-up min-w-0">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Sales</p>
          <h1 className="font-heading text-[26px] sm:text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">Quotes</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={openDueFollowupsModal}
            disabled={followupLoading}
            className="min-h-[40px] px-3 sm:px-4 rounded-full text-[10px] sm:text-[11px] font-bold uppercase tracking-wide border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]/50 hover:text-[var(--tx)] disabled:opacity-50 transition-colors"
          >
            {followupLoading ? "Loading…" : "Send Due Follow-Ups"}
          </button>
          <CreateButton href="/admin/quotes/new" title="New Quote" />
        </div>
      </div>

      {followupModalOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="due-followups-title"
        >
          <div className="w-full max-w-md max-h-[min(80vh,520px)] rounded-xl border border-[var(--brd)] bg-[var(--card)] shadow-xl flex flex-col">
            <div className="p-4 border-b border-[var(--brd)]/60">
              <h2 id="due-followups-title" className="text-[14px] font-bold text-[var(--tx)]">
                Send follow-ups to {followupPreview.length} quote{followupPreview.length === 1 ? "" : "s"}?
              </h2>
              <p className="text-[11px] text-[var(--tx3)] mt-1">
                Same rules as the scheduled cron (stages 1–3). SMS sends after a successful email when SMS is enabled.
              </p>
            </div>
            <div className="p-3 overflow-y-auto flex-1 min-h-0">
              {followupPreview.length === 0 ? (
                <p className="text-[12px] text-[var(--tx3)]">No quotes are due for a follow-up right now.</p>
              ) : (
                <ul className="text-[12px] space-y-1.5 font-mono text-[var(--tx2)]">
                  {followupPreview.map((row) => (
                    <li key={`${row.quote_id}-${row.stage}`}>
                      {row.quote_id} — Stage {row.stage}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4 border-t border-[var(--brd)]/60 flex justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setFollowupModalOpen(false);
                  setFollowupPreview([]);
                }}
                className="px-3 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:bg-[var(--bg)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={followupSending || followupPreview.length === 0}
                onClick={confirmSendDueFollowups}
                className="px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50"
              >
                {followupSending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)]">
        <KpiCard label="Total" value={String(quotes.length)} sub={`${sentCount} sent · ${viewedCount} viewed`} />
        <KpiCard label="Accepted" value={String(acceptedCount)} sub="confirmed bookings" accent={acceptedCount > 0} />
        <KpiCard label="Open Value" value={`$${(totalValue / 1000).toFixed(1)}K`} sub="total pipeline" />
        <KpiCard label="Sent" value={String(sentCount)} sub="awaiting response" />
      </div>

      <SectionDivider label="All Quotes" />

      <div className="flex gap-1.5 mb-6 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
        {STATUS_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setFilter(o.value)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-colors touch-manipulation ${
              filter === o.value
                ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold)]"
                : "border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--tx2)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="border-t border-[var(--brd)]/30 pt-5">
        <DataTable<Quote>
          data={filtered}
          columns={columns}
          keyField="id"
          tableId="quotes-list"
          searchable
          pagination
          exportable
          exportFilename="yugo-quotes"
          columnToggle
          selectable
          mobileCardLayout={{
            primaryColumnId: "client",
            subtitleColumnId: "quote_id",
            amountColumnId: "amount",
            metaColumnIds: ["service", "status", "sent_created"],
          }}
          onRowClick={(q) => router.push(`/admin/quotes/${q.quote_id || q.id}`)}
          emptyMessage="No quotes yet"
        />
      </div>

      {/* Mobile FAB */}
      <div className="sm:hidden fixed bottom-[calc(56px+env(safe-area-inset-bottom,0px)+16px)] right-4 z-[50]">
        <Link
          href="/admin/quotes/new"
          className="flex items-center justify-center w-14 h-14 rounded-full bg-[var(--gold)] text-[var(--btn-text-on-accent)] shadow-lg shadow-[var(--gold)]/25 active:scale-95 transition-transform touch-manipulation"
          aria-label="New quote"
        >
          <Plus size={22} weight="regular" className="text-current" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
