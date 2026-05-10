"use client";

import * as React from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-v2/composites/PageHeader";
import { MetricStrip } from "@/components/admin-v2/composites/MetricCard";
import { Button } from "@/components/admin-v2/primitives/Button";
import { Icon } from "@/components/admin-v2/primitives/Icon";
import {
  DropdownContent,
  DropdownItem,
  DropdownRoot,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/admin-v2/primitives/Dropdown";
import {
  ChipCell,
  DataTable,
  DateCell,
  IndicatorCell,
  NumericCell,
  SparklineCell,
  TextCell,
  type BulkAction,
  type ColumnConfig,
} from "@/components/admin-v2/datatable";
import { variantForStatus } from "@/components/admin-v2/primitives/Chip";
import { LeadDrawer } from "@/components/admin-v2/modules/lead-drawer";
import { useDrawer } from "@/components/admin-v2/layout/useDrawer";
import { LEAD_STATUS_LABEL } from "@/lib/admin-v2/labels";
import { formatCurrency, formatCurrencyCompact } from "@/lib/admin-v2/format";
import type { Lead } from "@/lib/admin-v2/mock/types";

const DAY_MS = 24 * 60 * 60 * 1000;

const leadsInWindow = (leads: Lead[], days: number) => {
  const now = Date.now();
  return leads.filter(
    (l) => now - new Date(l.lastAction).getTime() < days * DAY_MS,
  );
};

export type LeadsClientProps = {
  initialLeads: Lead[];
};

export const LeadsClient = ({ initialLeads }: LeadsClientProps) => {
  const [leads, setLeads] = React.useState<Lead[]>(() => initialLeads);

  React.useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);
  const drawer = useDrawer("lead");
  const activeLead = React.useMemo(
    () => leads.find((lead) => lead.id === drawer.id) ?? null,
    [drawer.id, leads],
  );

  const metrics = React.useMemo(() => {
    const last7 = leadsInWindow(leads, 7);
    const newCount = last7.filter((l) => l.status === "new").length;
    const closedCount = last7.filter((l) => l.status === "closed").length;
    const lostCount = last7.filter((l) => l.status === "lost").length;
    const totalClosed = leads
      .filter((l) => l.status === "closed")
      .reduce((sum, l) => sum + l.size, 0);
    const sparkline = (status: Lead["status"]) =>
      Array.from({ length: 7 }).map((_, index) => {
        const windowStart = Date.now() - (7 - index) * DAY_MS;
        const windowEnd = Date.now() - (6 - index) * DAY_MS;
        return leads.filter((l) => {
          const t = new Date(l.lastAction).getTime();
          return l.status === status && t >= windowStart && t < windowEnd;
        }).length;
      });
    return { newCount, closedCount, lostCount, totalClosed, sparkline };
  }, [leads]);

  const columns = React.useMemo<ColumnConfig<Lead>[]>(
    () => [
      {
        id: "lead",
        type: "identity",
        header: "Lead",
        priority: "p1",
        minWidth: 240,
        sortable: true,
        filterable: true,
        value: (row) => row.name,
        render: (row) => <TextCell primary={row.name} secondary={row.email} />,
      },
      {
        id: "source",
        type: "chip",
        header: "Source",
        priority: "p2",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.source,
        render: (row) => (
          <ChipCell
            label={row.source}
            variant="neutral"
            external={row.sourceExternal}
          />
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
            label={LEAD_STATUS_LABEL[row.status]}
            variant={variantForStatus(row.status)}
          />
        ),
      },
      {
        id: "size",
        type: "numeric",
        header: "Size",
        priority: "p1",
        sortable: true,
        filterable: true,
        align: "left",
        value: (row) => row.size,
        render: (row) => <NumericCell value={row.size} currency />,
      },
      {
        id: "interest",
        type: "sparkline",
        header: "Interest",
        priority: "p2",
        render: (row) => <SparklineCell data={row.interest} />,
      },
      {
        id: "probability",
        type: "indicator",
        header: "Probability",
        priority: "p2",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.probability,
        render: (row) => <IndicatorCell level={row.probability} />,
      },
      {
        id: "lastAction",
        type: "date",
        header: "Last action",
        priority: "p2",
        sortable: true,
        filterable: true,
        defaultSort: "desc",
        value: (row) => new Date(row.lastAction).getTime(),
        render: (row) => <DateCell value={row.lastAction} />,
      },
      {
        id: "owner",
        type: "text",
        header: "Owner",
        priority: "p3",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.ownerName || "Unassigned",
        render: (row) => (
          <span className="body-sm text-fg">
            {row.ownerName || <span className="text-fg-subtle">Unassigned</span>}
          </span>
        ),
      },
    ],
    [],
  );

  const bulkActions = React.useMemo<BulkAction<Lead>[]>(
    () => [
      {
        id: "engage",
        label: "Engage",
        handler: (rows) => {
          toast.success(`Engaged ${rows.length} leads`);
        },
      },
      {
        id: "group",
        label: "Create group",
        handler: (rows) => {
          toast.info(`Group created from ${rows.length} leads`);
        },
      },
      {
        id: "export",
        label: "Download as .CSV",
        handler: (rows) => {
          toast.info(`Exported ${rows.length} leads`);
        },
      },
      {
        id: "delete",
        label: "Delete leads",
        destructive: true,
        handler: (rows) => {
          const ids = new Set(rows.map((r) => r.id));
          setLeads((prev) => prev.filter((r) => !ids.has(r.id)));
          toast.error(`Deleted ${rows.length} leads`);
        },
      },
    ],
    [],
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Leads"
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Icon name="plus" size="sm" weight="bold" />}
              onClick={() => toast.message("Create lead flow opens here")}
            >
              New lead
            </Button>
            <DropdownRoot>
              <DropdownTrigger asChild>
                <Button variant="ghost" size="iconSm" aria-label="More actions">
                  <Icon name="more" size="md" />
                </Button>
              </DropdownTrigger>
              <DropdownContent align="end">
                <DropdownItem onSelect={() => toast.info("Import .CSV")}>
                  Import .CSV
                </DropdownItem>
                <DropdownItem onSelect={() => toast.info("Export all")}>
                  Export all
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem onSelect={() => toast.info("Lead settings")}>
                  Lead settings
                </DropdownItem>
              </DropdownContent>
            </DropdownRoot>
          </>
        }
      />

      <div className="label-sm text-fg-muted uppercase tracking-[0.08em]">
        Last 7 days
      </div>

      <MetricStrip
        items={[
          {
            label: "New",
            value: metrics.newCount.toString(),
            delta: { value: "+24%", direction: "up" },
            sparkline: metrics.sparkline("new"),
          },
          {
            label: "Closed",
            value: metrics.closedCount.toString(),
            delta: { value: "-4%", direction: "down" },
            sparkline: metrics.sparkline("closed"),
          },
          {
            label: "Lost",
            value: metrics.lostCount.toString(),
          },
          {
            label: "Total closed",
            value: formatCurrencyCompact(metrics.totalClosed),
            delta: { value: "+3%", direction: "up" },
            sparkline: metrics.sparkline("closed"),
          },
        ]}
      />

      <DataTable
        data={leads}
        columns={columns}
        getRowId={(row) => row.id}
        stateKey="leads"
        moduleLabel="leads"
        bulkActions={bulkActions}
        viewModes={["list", "board", "pipeline"]}
        savedViews={[
          {
            id: "hot",
            label: "Hot this week",
            filters: [
              { columnId: "probability", operator: "is", value: "high" },
            ],
            sort: [{ columnId: "lastAction", direction: "desc" }],
          },
          {
            id: "closing",
            label: "Closing",
            filters: [{ columnId: "status", operator: "is", value: "closing" }],
            sort: [{ columnId: "size", direction: "desc" }],
          },
        ]}
        renderBoard={(rows) => <LeadsBoard rows={rows} onOpen={drawer.open} />}
        renderPipeline={(rows) => (
          <LeadsBoard rows={rows} onOpen={drawer.open} />
        )}
        onRowClick={(row) => drawer.open(row.id)}
      />

      <LeadDrawer
        lead={activeLead}
        open={drawer.isOpen}
        onOpenChange={drawer.setOpen}
      />
    </div>
  );
};

const PIPELINE_ORDER: Lead["status"][] = [
  "new",
  "pre-sale",
  "closing",
  "closed",
  "lost",
];

const LeadsBoard = ({
  rows,
  onOpen,
}: {
  rows: Lead[];
  onOpen: (id: string) => void;
}) => {
  const byStatus = React.useMemo(() => {
    const map = new Map<Lead["status"], Lead[]>();
    for (const status of PIPELINE_ORDER) map.set(status, []);
    for (const row of rows) map.get(row.status)?.push(row);
    return map;
  }, [rows]);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {PIPELINE_ORDER.map((status) => {
        const items = byStatus.get(status) ?? [];
        return (
          <section
            key={status}
            className="flex flex-col gap-3 rounded-md border border-line bg-surface-subtle p-3"
          >
            <header className="flex items-center justify-between">
              <span className="label-sm text-fg-subtle uppercase tracking-[0.08em]">
                {LEAD_STATUS_LABEL[status]}
              </span>
              <span className="label-sm text-fg-muted tabular-nums">
                {items.length}
              </span>
            </header>
            <ul className="flex flex-col gap-2">
              {items.slice(0, 8).map((lead) => (
                <li key={lead.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(lead.id)}
                    className="flex w-full flex-col gap-1 rounded-md border border-line bg-surface px-3 py-2 text-left transition-colors hover:border-line-strong hover:shadow-sm"
                  >
                    <span className="body-sm font-medium text-fg truncate">
                      {lead.name}
                    </span>
                    <span className="body-xs text-fg-subtle truncate">
                      {formatCurrency(lead.size)} · {lead.source}
                    </span>
                  </button>
                </li>
              ))}
              {items.length > 8 ? (
                <li className="body-xs text-fg-subtle px-3 py-1">
                  +{items.length - 8} more
                </li>
              ) : null}
            </ul>
          </section>
        );
      })}
    </div>
  );
};
