import { B2bJobsSubNav } from "./B2bJobsSubNav"

export default function B2bJobsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <B2bJobsSubNav />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
