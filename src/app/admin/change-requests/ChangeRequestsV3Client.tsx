"use client"

import { PageHeader } from "@/design-system/admin/layout"
import { KpiStrip } from "@/design-system/admin/dashboard"
import ChangeRequestsClient from "./ChangeRequestsClient"

export default function ChangeRequestsV3Client({
  all,
  pending,
  reviewed,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  all: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pending: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reviewed: any[]
}) {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        eyebrow="Operations"
        title="Change requests"
        description="Client-initiated edits on booked moves awaiting coordinator review."
      />
      <KpiStrip
        tiles={[
          { id: "pending", label: "Pending", value: String(pending.length), hint: "awaiting review" },
          { id: "reviewed", label: "Reviewed", value: String(reviewed.length), hint: "actioned" },
          { id: "total", label: "Total", value: String(all.length), hint: "all time" },
        ]}
        columns={3}
      />
      <ChangeRequestsClient all={all} pending={pending} reviewed={reviewed} />
    </div>
  )
}
