import { CrewSubNav } from "./CrewSubNav"

export default function CrewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <CrewSubNav />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
