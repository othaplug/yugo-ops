"use client";

import Link from "next/link";
import Badge from "../components/Badge";
import { formatCurrency } from "@/lib/format-currency";
import DataTable, { type ColumnDef } from "@/components/admin/DataTable";

export default function InvoicesTable({
  invoices,
  onRowClick,
}: {
  invoices: any[];
  onRowClick?: (invoice: any) => void;
}) {
  const columns: ColumnDef<any>[] = [
    {
      id: "invoice_number",
      label: "Invoice",
      accessor: (r) => r.invoice_number,
      render: (r) => (
        <span className="font-mono font-semibold">{r.invoice_number}</span>
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
            <span className="font-bold">{formatCurrency(r.amount)}</span>
            {amt > 0 && (
              <span className="text-[8px] text-[var(--tx3)] ml-1">+{formatCurrency(Math.round(amt * 0.13))} HST</span>
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
      onRowClick={onRowClick}
    />
  );
}
