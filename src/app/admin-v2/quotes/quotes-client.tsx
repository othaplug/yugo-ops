"use client"

import * as React from "react"
import { toast } from "sonner"
import { PageHeader } from "@/components/admin-v2/composites/PageHeader"
import { MetricStrip } from "@/components/admin-v2/composites/MetricCard"
import { Button } from "@/components/admin-v2/primitives/Button"
import { Icon } from "@/components/admin-v2/primitives/Icon"
import {
  ChipCell,
  DataTable,
  DateCell,
  NumericCell,
  TextCell,
  type BulkAction,
  type ColumnConfig,
} from "@/components/admin-v2/datatable"
import { variantForStatus } from "@/components/admin-v2/primitives/Chip"
import { QuoteDrawer } from "@/components/admin-v2/modules/quote-drawer"
import { useDrawer } from "@/components/admin-v2/layout/useDrawer"
import {
  QUOTE_STATUS_LABEL,
  SERVICE_TYPE_LABEL,
  TIER_LABEL,
} from "@/lib/admin-v2/labels"
import { formatCurrencyCompact } from "@/lib/admin-v2/format"
import { getMockUniverse } from "@/lib/admin-v2/mock"
import type { Quote } from "@/lib/admin-v2/mock/types"

const DAY_MS = 24 * 60 * 60 * 1000

const countIn7Days = (quotes: Quote[], pick: (q: Quote) => string | null) =>
  quotes.filter((q) => {
    const ts = pick(q)
    if (!ts) return false
    return Date.now() - new Date(ts).getTime() < 7 * DAY_MS
  }).length

export const QuotesClient = () => {
  const universe = React.useMemo(() => getMockUniverse(), [])
  const [quotes, setQuotes] = React.useState<Quote[]>(() => universe.quotes)
  const drawer = useDrawer("quote")
  const activeQuote = React.useMemo(
    () => quotes.find((q) => q.id === drawer.id) ?? null,
    [drawer.id, quotes],
  )

  const metrics = React.useMemo(() => {
    const sentCount = countIn7Days(quotes, (q) => q.sentAt)
    const viewedCount = countIn7Days(quotes, (q) => q.viewedAt)
    const acceptedCount = quotes.filter((q) => q.status === "accepted").length
    const expiredCount = quotes.filter((q) => q.status === "expired").length
    const totalValue = quotes
      .filter((q) => q.status === "accepted")
      .reduce((sum, q) => sum + q.total, 0)
    return { sentCount, viewedCount, acceptedCount, expiredCount, totalValue }
  }, [quotes])

  const columns = React.useMemo<ColumnConfig<Quote>[]>(
    () => [
      {
        id: "quote",
        type: "identity",
        header: "Quote",
        priority: "p1",
        minWidth: 220,
        sortable: true,
        filterable: true,
        value: (row) => row.number,
        render: (row) => (
          <TextCell primary={row.number} secondary={row.customerName} />
        ),
      },
      {
        id: "tier",
        type: "chip",
        header: "Tier",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.tier,
        render: (row) => {
          const variant =
            row.tier === "estate"
              ? "brand"
              : row.tier === "signature"
                ? "info"
                : "neutral"
          return <ChipCell label={TIER_LABEL[row.tier]} variant={variant} />
        },
      },
      {
        id: "service",
        type: "chip",
        header: "Service",
        priority: "p2",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.serviceType,
        render: (row) => (
          <ChipCell label={SERVICE_TYPE_LABEL[row.serviceType]} variant="neutral" />
        ),
      },
      {
        id: "status",
        type: "chip",
        header: "Status",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.status,
        render: (row) => (
          <ChipCell
            label={QUOTE_STATUS_LABEL[row.status]}
            variant={variantForStatus(row.status)}
          />
        ),
      },
      {
        id: "total",
        type: "numeric",
        header: "Total",
        priority: "p1",
        sortable: true,
        filterable: true,
        value: (row) => row.total,
        render: (row) => <NumericCell value={row.total} currency />,
      },
      {
        id: "sentAt",
        type: "date",
        header: "Sent",
        priority: "p2",
        sortable: true,
        filterable: true,
        defaultSort: "desc",
        value: (row) => (row.sentAt ? new Date(row.sentAt).getTime() : 0),
        render: (row) =>
          row.sentAt ? (
            <DateCell value={row.sentAt} />
          ) : (
            <span className="body-sm text-fg-subtle">Not sent</span>
          ),
      },
      {
        id: "expiresAt",
        type: "date",
        header: "Expires",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => new Date(row.expiresAt).getTime(),
        render: (row) => <DateCell value={row.expiresAt} />,
      },
    ],
    [],
  )

  const bulkActions = React.useMemo<BulkAction<Quote>[]>(
    () => [
      {
        id: "resend",
        label: "Resend",
        handler: (rows) => {
          toast.success(`Resent ${rows.length} quotes`)
        },
      },
      {
        id: "export",
        label: "Download as .CSV",
        handler: (rows) => {
          toast.info(`Exported ${rows.length} quotes`)
        },
      },
      {
        id: "delete",
        label: "Delete quotes",
        destructive: true,
        handler: (rows) => {
          const ids = new Set(rows.map((r) => r.id))
          setQuotes((prev) => prev.filter((r) => !ids.has(r.id)))
          toast.error(`Deleted ${rows.length} quotes`)
        },
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Quotes"
        actions={
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Icon name="plus" size="sm" weight="bold" />}
            onClick={() => toast.message("Create quote flow opens here")}
          >
            New quote
          </Button>
        }
      />

      <MetricStrip
        items={[
          { label: "Sent 7d", value: metrics.sentCount.toString() },
          { label: "Viewed 7d", value: metrics.viewedCount.toString() },
          { label: "Accepted", value: metrics.acceptedCount.toString() },
          {
            label: "Accepted value",
            value: formatCurrencyCompact(metrics.totalValue),
          },
        ]}
      />

      <DataTable
        data={quotes}
        columns={columns}
        getRowId={(row) => row.id}
        stateKey="quotes"
        moduleLabel="quotes"
        bulkActions={bulkActions}
        viewModes={["list"]}
        savedViews={[
          {
            id: "needs-follow-up",
            label: "Needs follow-up",
            filters: [{ columnId: "status", operator: "is", value: "sent" }],
            sort: [{ columnId: "sentAt", direction: "asc" }],
          },
          {
            id: "expired",
            label: "Expired",
            filters: [{ columnId: "status", operator: "is", value: "expired" }],
            sort: [{ columnId: "expiresAt", direction: "desc" }],
          },
        ]}
        onRowClick={(row) => drawer.open(row.id)}
      />

      <QuoteDrawer
        quote={activeQuote}
        open={drawer.isOpen}
        onOpenChange={drawer.setOpen}
      />
    </div>
  )
}
