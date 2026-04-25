import { PageHeader } from "@/design-system/admin/layout/PageHeader"
import { Card, CardBody, EmptyState } from "@/design-system/admin/primitives"
import Link from "next/link"
import { Button } from "@/design-system/admin/primitives"

export const metadata = { title: "Crew assignments" }
export const dynamic = "force-dynamic"
export const revalidate = 0

export default function CrewAssignmentsPage() {
  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader
        eyebrow="Crew"
        title="Assignments"
        description="A list view of crew to job assignments is on the way."
      />
      <Card>
        <CardBody className="py-8">
          <EmptyState
            title="List view in progress"
            description="The map view shows current assignments. A dedicated list is coming."
            action={
              <Button variant="primary" size="sm" asChild>
                <Link href="/admin/crew">Open live map</Link>
              </Button>
            }
          />
        </CardBody>
      </Card>
    </div>
  )
}
