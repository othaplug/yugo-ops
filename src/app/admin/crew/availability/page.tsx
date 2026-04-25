import { PageHeader } from "@/design-system/admin/layout/PageHeader"
import { Card, CardBody, EmptyState } from "@/design-system/admin/primitives"

export const metadata = { title: "Crew availability" }
export const dynamic = "force-dynamic"
export const revalidate = 0

export default function CrewAvailabilityPage() {
  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader
        eyebrow="Crew"
        title="Availability"
        description="Team availability by day. Full scheduling is coming here."
      />
      <Card>
        <CardBody className="py-8">
          <EmptyState
            title="Calendar coming soon"
            description="Use the live map to see who is on which job today."
          />
        </CardBody>
      </Card>
    </div>
  )
}
