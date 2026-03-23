"use client";

import { useCallback } from "react";
import Link from "next/link";
import Badge from "../components/Badge";
import { formatCurrency, calcHST } from "@/lib/format-currency";
import DataTable, { type ColumnDef, type BulkAction } from "@/components/admin/DataTable";
import { useToast } from "../components/Toast";
import { ArrowSquareOut } from "@phosphor-icons/react";

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
      accessor: (r) => r.invoice_number,
      render: (r) => (
        <div>
          <span className="dt-text-id">{r.invoice_number}</span>
          {r.delivery_id && (
            <span className="ml-2 inline-flex items-center dt-text-meta px-1.5 py-0.5 rounded bg-[var(--gold)]/10 text-[var(--gold)]">
              Delivery
            </span>
          )}
          {r.move_id && !r.delivery_id && (
            <span className="ml-2 inline-flex items-center dt-text-meta px-1.5 py-0.5 rounded bg-blue-50 text-blue-600">
              Move
            </span>
          )}
        </div>
      ),
      searchable: true,
    },
    {
      id: "client_name",
      label: "Client",
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
      id: "due_date",
      label: "Due Date",
      accessor: (r) => r.due_date,
      sortable: true,
    },
    {
      id: "status",
      label: "Status",
      accessor: (r) => r.status,
      render: (r) => <Badge status={r.status} />,
      sortable: true,
    },
    {
      id: "square",
      label: "Square",
      accessor: (r) => r.square_invoice_url || "",
      render: (r) =>
        r.square_invoice_url ? (
          <a
            href={r.square_invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--gold)] hover:underline"
          >
            <ArrowSquareOut size={10} weight="regular" className="text-current shrink-0" aria-hidden />
            View
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
