"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import AdminInvoiceDetailModal from "./AdminInvoiceDetailModal";
import InvoicesTable from "./InvoicesTable";
import { ToastProvider, useToast } from "../components/Toast";

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

function InvoicesPageInner({ invoices }: InvoicesPageClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [detailInvoice, setDetailInvoice] = useState<typeof invoices[0] | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortCol, setSortCol] = useState<string>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [backfilling, setBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<string | null>(null);
  const [syncingSquare, setSyncingSquare] = useState(false);

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

  const runSquareSync = async () => {
    setSyncingSquare(true);
    try {
      const res = await fetch("/api/admin/invoices/reconcile-square", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 100 }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Sync failed", "x");
        return;
      }
      const n = typeof data.markedPaid === "number" ? data.markedPaid : 0;
      const checked = typeof data.checked === "number" ? data.checked : 0;
      const linked = typeof data.linkedIds === "number" ? data.linkedIds : 0;
      const errList = Array.isArray(data.errors) ? (data.errors as string[]).slice(0, 2).join(" ") : "";
      const parts = [
        n > 0 ? `Marked ${n} paid` : "No new paid matches",
        checked > 0 ? `checked ${checked}` : null,
        linked > 0 ? `linked ${linked} Square id${linked !== 1 ? "s" : ""}` : null,
        errList ? `Notes: ${errList}` : null,
      ].filter(Boolean);
      toast(parts.join(". ") || "Done", n > 0 || linked > 0 ? "check" : "check");
      if (n > 0 || linked > 0) router.refresh();
    } catch {
      toast("Sync failed", "x");
    } finally {
      setSyncingSquare(false);
    }
  };

  const filteredInvoices = useMemo(() => {
    if (statusFilter === "all") return invoices;
    return invoices.filter((inv) => (inv.status || "").toLowerCase() === statusFilter);
  }, [invoices, statusFilter]);

  return (
    <>
      <div>
        <div className="px-0 py-4 border-b border-[var(--brd)]/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h3 className="font-heading text-[15px] font-bold text-[var(--tx)]">All Invoices</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={runBackfill}
              disabled={backfilling}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all disabled:opacity-50"
            >
              {backfilling ? "Generating…" : "Generate Invoices"}
            </button>
            <button
              type="button"
              onClick={runSquareSync}
              disabled={syncingSquare}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:bg-[var(--bg2)] transition-all disabled:opacity-50"
            >
              {syncingSquare ? "Syncing…" : "Sync paid from Square"}
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
              className={`px-3 py-1.5 rounded-md text-[10px] font-semibold transition-all border ${
                statusFilter === f.value
                  ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] border-[var(--admin-primary-fill)]"
                  : "bg-[var(--bg)] text-[var(--tx)] border-[var(--brd)] hover:bg-[var(--bg2)]"
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
    </>
  );
}

export default function InvoicesPageClient(props: InvoicesPageClientProps) {
  return (
    <ToastProvider>
      <InvoicesPageInner {...props} />
    </ToastProvider>
  );
}
