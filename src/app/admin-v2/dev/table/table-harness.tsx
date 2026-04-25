"use client";

import * as React from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/admin-v2/composites/PageHeader";
import { MetricCard } from "@/components/admin-v2/composites/MetricCard";
import {
  DataTable,
  type ColumnConfig,
  type BulkAction,
  ChipCell,
  DateCell,
  IdentityCell,
  IndicatorCell,
  NumericCell,
  SparklineCell,
} from "@/components/admin-v2/datatable";
import { variantForStatus } from "@/components/admin-v2/primitives/Chip";
import { generateLeads, type Lead } from "./seed";

const STATUS_LABEL: Record<Lead["status"], string> = {
  new: "NEW",
  "pre-sale": "PRE-SALE",
  closing: "CLOSING",
  closed: "CLOSED",
  lost: "LOST",
};

const LEADS = generateLeads(500, 7);

export const TableHarness = () => {
  const [data, setData] = React.useState<Lead[]>(() => LEADS);

  const columns = React.useMemo<ColumnConfig<Lead>[]>(
    () => [
      {
        id: "identity",
        type: "identity",
        header: "Lead",
        priority: "p1",
        minWidth: 220,
        sortable: true,
        filterable: true,
        value: (row) => row.name,
        render: (row) => (
          <IdentityCell primary={row.name} secondary={row.email} />
        ),
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
            label={STATUS_LABEL[row.status]}
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
        sortable: false,
        filterable: false,
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
          toast.info(`Exported ${rows.length} leads to CSV`);
        },
      },
      {
        id: "delete",
        label: "Delete leads",
        destructive: true,
        handler: (rows) => {
          const ids = new Set(rows.map((r) => r.id));
          setData((prev) => prev.filter((r) => !ids.has(r.id)));
          toast.error(`Deleted ${rows.length} leads`);
        },
      },
    ],
    [],
  );

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="DataTable harness"
        description={`Seeded with ${data.length} leads. Exercise sort, multi-sort (shift-click), filter, group, selection, keyboard nav, and virtualization.`}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard
          label="New 7d"
          value="326"
          delta={{ value: "+24%", direction: "up" }}
          sparkline={[3, 5, 4, 6, 7, 9, 11]}
        />
        <MetricCard
          label="Closed 7d"
          value="46"
          delta={{ value: "-4%", direction: "down" }}
          sparkline={[11, 10, 9, 8, 8, 6, 5]}
        />
        <MetricCard label="Lost" value="3" />
        <MetricCard
          label="Total closed"
          value="$1,287,500"
          delta={{ value: "+3%", direction: "up" }}
          sparkline={[800, 820, 900, 960, 1040, 1180, 1287]}
        />
      </div>

      <DataTable
        data={data}
        columns={columns}
        getRowId={(row) => row.id}
        stateKey="dev_leads"
        moduleLabel="leads"
        bulkActions={bulkActions}
        savedViews={[
          {
            id: "pre-sale",
            label: "Pre-sale",
            filters: [
              { columnId: "status", operator: "is", value: "pre-sale" },
            ],
            sort: [{ columnId: "size", direction: "desc" }],
          },
          {
            id: "hot",
            label: "High probability",
            filters: [
              { columnId: "probability", operator: "is", value: "high" },
            ],
            sort: [{ columnId: "lastAction", direction: "desc" }],
          },
        ]}
        viewModes={["list"]}
        onRowClick={(row) => {
          toast.message(`Opened ${row.name}`, { description: row.email });
        }}
      />
    </div>
  );
};
