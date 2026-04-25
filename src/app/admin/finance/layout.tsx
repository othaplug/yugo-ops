import { FinanceSubNav } from "./FinanceSubNav"

export default function FinanceLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
      <FinanceSubNav />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
