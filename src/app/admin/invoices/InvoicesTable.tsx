"use client";

import { useCallback } from "react";
import Link from "next/link";
import { formatCurrency, calcHST } from "@/lib/format-currency";
import { getInvoiceStatusLabel, invoiceStatusBadgeClass } from "@/lib/invoice-admin-status";
import DataTable, { type ColumnDef, type BulkAction } from "@/components/admin/DataTable";
import { formatAdminCreatedAt } from "@/lib/date-format";
import { useToast } from "../components/Toast";
import { getInvoiceServiceTypeLabel } from "@/utils/partnerType";
import { displayInvoiceNumber } from "@/lib/invoice-display-number";

/** Strip protocol and truncate for table display; full URL stays on the link + title. */
function shortenInvoiceUrl(raw: string, maxLen = 44): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    const host = u.hostname.replace(/^www\./, "");
    const tail = `${u.pathname}${u.search}` || "/";
    const combined = `${host}${tail}`;
    if (combined.length <= maxLen) return combined;
    return `${combined.slice(0, maxLen - 1)}…`;
  } catch {
    const noProto = trimmed.replace(/^https?:\/\//i, "");
    if (noProto.length <= maxLen) return noProto;
    return `${noProto.slice(0, maxLen - 1)}…`;
  }
}

export default function InvoicesTable({
  invoices,
  onRowClick,
  onRefresh,
  sortCol,
  sortDir,
  onSortChange,
}: {
  invoices: any[];
  onRowClick?: (invoice: any) => void;
  onRefresh?: () => void;
  sortCol?: string;
  sortDir?: "asc" | "desc";
  onSortChange?: (col: string, dir: "asc" | "desc") => void;
}) {
  const { toast } = useToast();

  const runBulk = useCallback(
    async (action: "archive" | "cancel" | "delete" | "mark_paid", ids: string[]) => {
      const res = await fetch("/api/admin/invoices/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      });
      const data = await res.json();
      if (data.ok) {
        const labels: Record<string, string> = {
          archive: "Archived",
          cancel: "Cancelled",
          delete: "Deleted",
          mark_paid: "Marked as paid",
        };
        toast(`${labels[action] || action} ${data.updated} invoice${data.updated !== 1 ? "s" : ""}`, "check");
        onRefresh?.();
      } else {
        toast("Error: " + (data.error || "Failed"), "x");
      }
    },
    [toast, onRefresh]
  );

  const bulkActions: BulkAction[] = [
    { label: "Mark as paid", onClick: (ids) => runBulk("mark_paid", ids) },
    { label: "Archive", onClick: (ids) => runBulk("archive", ids) },
    { label: "Cancel", onClick: (ids) => runBulk("cancel", ids) },
    { label: "Delete", onClick: (ids) => runBulk("delete", ids), variant: "danger" },
  ];
  const columns: ColumnDef<any>[] = [
    {
      id: "invoice_number",
      label: "Invoice",
      minWidth: "132px",
      defaultWidth: 156,
      accessor: (r) => displayInvoiceNumber(r),
      render: (r) => {
        const typeLabel = getInvoiceServiceTypeLabel(r);
        const isMove = typeLabel === "Move";
        const num = displayInvoiceNumber(r);
        return (
          <div>
            <span className="dt-text-id">{num}</span>
            <span
              className={`ml-2 inline-flex items-center dt-badge ${
                isMove ? "text-blue-600" : "text-[var(--gold)]"
              }`}
            >
              {typeLabel}
            </span>
          </div>
        );
      },
      searchable: true,
    },
    {
      id: "client_name",
      label: "Client",
      minWidth: "156px",
      defaultWidth: 208,
      accessor: (r) => r.client_name,
      render: (r) => (
        <Link
          href="/admin/clients"
          onClick={(e) => e.stopPropagation()}
          className="hover:text-[var(--gold)] transition-colors"
        >
          {r.client_name}
        </Link>
      ),
      searchable: true,
    },
    {
      id: "amount",
      label: "Amount",
      accessor: (r) => Number(r.amount),
      render: (r) => {
        const amt = Number(r.amount);
        return (
          <>
            <span className="dt-amount-neutral">{formatCurrency(r.amount)}</span>
            {amt > 0 && (
              <span className="dt-text-meta ml-1 block sm:inline">
                +{formatCurrency(calcHST(amt))} HST
              </span>
            )}
          </>
        );
      },
      sortable: true,
      align: "right",
      exportAccessor: (r) => formatCurrency(r.amount),
    },
    {
      id: "created_at",
      label: "Create date",
      accessor: (r) => r.created_at || "",
      sortable: true,
      render: (r) => (
        <span className="text-[11px] text-[var(--tx2)] tabular-nums whitespace-nowrap">
          {r.created_at ? formatAdminCreatedAt(r.created_at) : "—"}
        </span>
      ),
      exportAccessor: (r) => (r.created_at ? formatAdminCreatedAt(r.created_at) : ""),
    },
    {
      id: "due_date",
      label: "Due Date",
      accessor: (r) => r.due_date,
      sortable: true,
    },
    {
      id: "status",
      label: "Status",
      accessor: (r) => getInvoiceStatusLabel(r.status),
      render: (r) => (
        <span
          className={`inline-flex items-center dt-badge tracking-[0.04em] uppercase ${invoiceStatusBadgeClass(r.status)}`}
        >
          {getInvoiceStatusLabel(r.status)}
        </span>
      ),
      sortable: true,
    },
    {
      id: "square",
      label: "Square",
      minWidth: "140px",
      defaultWidth: 200,
      accessor: (r) =>
        [r.square_invoice_url, r.square_invoice_id].filter(Boolean).join(" ") || "",
      render: (r) =>
        r.square_invoice_url ? (
          <a
            href={r.square_invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            title={r.square_invoice_url}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex flex-col items-start gap-0.5 sm:flex-row sm:items-baseline sm:gap-1.5 text-left max-w-[min(200px,28vw)]"
          >
            <span className="text-[10px] font-semibold text-[var(--gold)] hover:underline shrink-0">View</span>
            <span className="text-[9px] font-mono text-[var(--tx3)] truncate w-full sm:max-w-[160px]" title={r.square_invoice_url}>
              {shortenInvoiceUrl(String(r.square_invoice_url))}
            </span>
          </a>
        ) : null,
    },
  ];

  return (
    <DataTable
      data={invoices || []}
      columns={columns}
      keyField="id"
      tableId="invoices"
      searchable
      searchPlaceholder="Search invoices…"
      pagination
      exportable
      exportFilename="yugo-invoices"
      columnToggle
      selectable
      bulkActions={bulkActions}
      mobileCardLayout={{
        primaryColumnId: "client_name",
        subtitleColumnId: "invoice_number",
        amountColumnId: "amount",
        metaColumnIds: ["status", "due_date", "square"],
      }}
      onRowClick={onRowClick}
      {...(sortCol != null && sortDir != null && onSortChange
        ? { sortCol, sortDir, onSortChange }
        : {})}
    />
  );
}
