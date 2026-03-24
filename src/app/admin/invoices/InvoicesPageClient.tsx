"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import AdminInvoiceDetailModal from "./AdminInvoiceDetailModal";
import InvoicesTable from "./InvoicesTable";
import { ToastProvider } from "../components/Toast";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
  { value: "cancelled", label: "Cancelled" },
  { value: "archived", label: "Archived" },
] as const;

const SORT_OPTIONS = [
  { col: "created_at", dir: "desc" as const, label: "Create date: Newest" },
  { col: "created_at", dir: "asc" as const, label: "Create date: Oldest" },
  { col: "due_date", dir: "desc" as const, label: "Due date: Newest" },
  { col: "due_date", dir: "asc" as const, label: "Due date: Oldest" },
  { col: "client_name", dir: "asc" as const, label: "Customer name: A–Z" },
  { col: "client_name", dir: "desc" as const, label: "Customer name: Z–A" },
  { col: "amount", dir: "desc" as const, label: "Amount: High to low" },
  { col: "amount", dir: "asc" as const, label: "Amount: Low to high" },
] as const;

interface InvoicesPageClientProps {
  invoices: any[];
}

export default function InvoicesPageClient({ invoices }: InvoicesPageClientProps) {
  const router = useRouter();
  const [detailInvoice, setDetailInvoice] = useState<typeof invoices[0] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortCol, setSortCol] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);

  const runBackfill = async () => {
    setBackfilling(true);
    setBackfillResult(null);
    try {
      const res = await fetch("/api/admin/invoices/backfill-deliveries", { method: "POST" });
      const data = await res.json();
      setBackfillResult(data.created > 0 ? `Created ${data.created} invoice${data.created !== 1 ? "s" : ""}` : "All caught up");
      if (data.created > 0) router.refresh();
    } catch {
      setBackfillResult("Failed");
    } finally {
      setBackfilling(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    if (statusFilter === "all") return invoices;
    return invoices.filter((inv) => (inv.status || "").toLowerCase() === statusFilter);
  }, [invoices, statusFilter]);

  return (
    <ToastProvider>
      <div>
        <div className="px-0 py-4 border-b border-[var(--brd)]/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="font-heading text-[15px] font-bold text-[var(--tx)]">All Invoices</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={runBackfill}
              disabled={backfilling}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
            >
              {backfilling ? "Generating…" : "Generate Invoices"}
            </button>
            {backfillResult && (
              <span className="text-[10px] text-[var(--tx3)]">{backfillResult}</span>
            )}
          </div>
        </div>
        <div className="px-0 py-3 border-b border-[var(--brd)]/30 flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-all ${
                statusFilter === f.value
                  ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                  : "bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:bg-[var(--bg2)] hover:border-[var(--brd)]"
              }`}
            >
              {f.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-semibold text-[var(--tx3)]">Sort by</span>
            <select
              value={`${sortCol}:${sortDir}`}
              onChange={(e) => {
                const [col, dir] = (e.target.value as string).split(":") as [string, "asc" | "desc"];
                if (col && dir) {
                  setSortCol(col);
                  setSortDir(dir);
                }
              }}
              className="text-[10px] bg-[var(--card)] border border-[var(--brd)] rounded-lg px-3 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={`${opt.col}:${opt.dir}`} value={`${opt.col}:${opt.dir}`}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <InvoicesTable
            invoices={filteredInvoices}
            onRowClick={(inv) => setDetailInvoice(inv)}
            onRefresh={() => router.refresh()}
            sortCol={sortCol}
            sortDir={sortDir}
            onSortChange={(col, dir) => {
              setSortCol(col);
              setSortDir(dir);
            }}
          />
        </div>
      </div>
      <AdminInvoiceDetailModal
        open={!!detailInvoice}
        onClose={() => setDetailInvoice(null)}
        invoice={detailInvoice}
        onSaved={() => router.refresh()}
      />
    </ToastProvider>
  );
}
