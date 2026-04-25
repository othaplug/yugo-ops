import { PageHeader } from "@/components/admin-v2/composites"
import { EmptyState } from "@/components/admin-v2/primitives"

type PlaceholderProps = {
  title: string
  description?: string
  note?: string
}

export const PlaceholderPage = ({
  title,
  description,
  note,
}: PlaceholderProps) => (
  <div className="flex min-h-full flex-col">
    <PageHeader title={title} description={description} />
    <div className="flex flex-1 items-center justify-center pb-16">
      <EmptyState
        title={`${title} coming soon`}
        description={
          note ??
          "This surface is being rebuilt under the new admin design system. Data and interactions will arrive in the next phase."
        }
      />
    </div>
  </div>
)
