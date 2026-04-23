import { MetricStrip } from "@/components/admin-v2/composites"
import { PageHeader } from "@/components/admin-v2/composites"
import { Card, CardTitle } from "@/components/admin-v2/composites"

const DashboardPage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader
      title="Dashboard"
      description="Operational snapshot across leads, quotes, moves, and revenue."
    />
    <MetricStrip
      items={[
        {
          label: "Revenue MTD",
          value: "$1,287,500",
          delta: { value: "+3%", direction: "up" },
        },
        {
          label: "Active moves",
          value: "46",
          delta: { value: "-4%", direction: "down" },
        },
        {
          label: "New leads (7d)",
          value: "326",
          delta: { value: "+24%", direction: "up" },
        },
        {
          label: "Pipeline value",
          value: "$820,000",
          delta: { value: "+12%", direction: "up" },
        },
      ]}
    />
    <Card>
      <CardTitle>Revenue</CardTitle>
      <p className="mt-1 body-sm text-fg-muted">
        MRR chart lands in Phase 4 with TanStack Query wiring.
      </p>
      <div className="mt-4 h-[240px] rounded-md border border-dashed border-line bg-surface-subtle" />
    </Card>
  </div>
)

export default DashboardPage
