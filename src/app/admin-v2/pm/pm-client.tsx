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
  NumericCell,
  TextCell,
  type BulkAction,
  type ColumnConfig,
} from "@/components/admin-v2/datatable"
import { PMDrawer } from "@/components/admin-v2/modules/pm-drawer"
import { useDrawer } from "@/components/admin-v2/layout/useDrawer"
import { PM_CONTRACT_LABEL } from "@/lib/admin-v2/labels"
import type { PMAccount, Move } from "@/lib/admin-v2/mock/types"

export type PMClientProps = {
  initialAccounts: PMAccount[]
  moves?: Move[]
}

export const PMClient = ({ initialAccounts, moves = [] }: PMClientProps) => {
  const [accounts, setAccounts] = React.useState<PMAccount[]>(() => initialAccounts)
  React.useEffect(() => {
    setAccounts(initialAccounts)
  }, [initialAccounts])
  const drawer = useDrawer("pm")
  const activeAccount = React.useMemo(
    () => accounts.find((a) => a.id === drawer.id) ?? null,
    [accounts, drawer.id],
  )

  const metrics = React.useMemo(() => {
    const active = accounts.filter((a) => a.contractStatus === "active").length
    const renewal = accounts.filter((a) => a.contractStatus === "renewal").length
    const buildings = accounts.reduce((s, a) => s + a.buildings, 0)
    const moves = accounts.reduce((s, a) => s + a.movesLast30, 0)
    return { active, renewal, buildings, moves }
  }, [accounts])

  const columns = React.useMemo<ColumnConfig<PMAccount>[]>(
    () => [
      {
        id: "account",
        type: "identity",
        header: "Account",
        priority: "p1",
        minWidth: 240,
        sortable: true,
        filterable: true,
        value: (row) => row.name,
        render: (row) => (
          <TextCell primary={row.name} secondary={row.primaryContact} />
        ),
      },
      {
        id: "contract",
        type: "chip",
        header: "Contract",
        priority: "p1",
        sortable: true,
        filterable: true,
        groupable: true,
        value: (row) => row.contractStatus,
        render: (row) => (
          <ChipCell
            label={PM_CONTRACT_LABEL[row.contractStatus]}
            variant={
              row.contractStatus === "active"
                ? "success"
                : row.contractStatus === "renewal"
                  ? "warning"
                  : "danger"
            }
          />
        ),
      },
      {
        id: "buildings",
        type: "numeric",
        header: "Buildings",
        priority: "p2",
        sortable: true,
        filterable: true,
        defaultSort: "desc",
        value: (row) => row.buildings,
        render: (row) => <NumericCell value={row.buildings} />,
      },
      {
        id: "moves",
        type: "numeric",
        header: "Moves 30d",
        priority: "p2",
        sortable: true,
        filterable: true,
        value: (row) => row.movesLast30,
        render: (row) => <NumericCell value={row.movesLast30} />,
      },
    ],
    [],
  )

  const bulkActions = React.useMemo<BulkAction<PMAccount>[]>(
    () => [
      {
        id: "statement",
        label: "Generate statements",
        handler: (rows) => {
          toast.success(`Statements queued for ${rows.length} accounts`)
        },
      },
      {
        id: "export",
        label: "Download as .CSV",
        handler: (rows) => {
          toast.info(`Exported ${rows.length} accounts`)
        },
      },
    ],
    [],
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Property management"
        actions={
          <Button
            variant="secondary"
            size="sm"
            leadingIcon={<Icon name="plus" size="sm" weight="bold" />}
            onClick={() => toast.message("New PM account flow opens here")}
          >
            New account
          </Button>
        }
      />

      <MetricStrip
        items={[
          { label: "Active accounts", value: metrics.active.toString() },
          { label: "Renewal", value: metrics.renewal.toString() },
          { label: "Buildings", value: metrics.buildings.toString() },
          { label: "Moves (30d)", value: metrics.moves.toString() },
        ]}
      />

      <DataTable
        data={accounts}
        columns={columns}
        getRowId={(row) => row.id}
        stateKey="pm"
        moduleLabel="accounts"
        bulkActions={bulkActions}
        viewModes={["list"]}
        onRowClick={(row) => drawer.open(row.id)}
      />

      <PMDrawer
        account={activeAccount}
        open={drawer.isOpen}
        onOpenChange={drawer.setOpen}
        moves={moves}
      />
    </div>
  )
}
