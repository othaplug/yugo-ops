import Link from "next/link"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  PageHeader,
  PageMetaDivider,
} from "@/design-system/admin/layout/PageHeader"
import {
  FileText,
  TrendUp,
  CurrencyDollar,
  ChartPie,
} from "@/design-system/admin/icons"
import { formatCompactCurrency } from "@/lib/format-currency"

export const metadata = { title: "Finance" }
export const dynamic = "force-dynamic"
export const revalidate = 0

const cards = [
  {
    href: "/admin/finance/invoices" as const,
    title: "Invoices",
    description: "Partner and client invoices, payment status, and aging.",
    icon: FileText,
  },
  {
    href: "/admin/finance/revenue" as const,
    title: "Revenue trends",
    description: "Paid moves, B2B delivery revenue, and mix over time.",
    icon: TrendUp,
  },
  {
    href: "/admin/finance/profitability" as const,
    title: "Profitability",
    description: "Margins and contribution by service and segment.",
    icon: ChartPie,
  },
  {
    href: "/admin/finance/tips" as const,
    title: "Tips",
    description: "Crew tips, allocations, and totals.",
    icon: CurrencyDollar,
  },
]

export default async function FinanceOverviewPage() {
  const db = createAdminClient()
  const [invRes, tipsRes] = await Promise.all([
    db
      .from("invoices")
      .select("id, amount, status")
      .limit(2000),
    db.from("tips").select("amount, net_amount").limit(500),
  ])
  const invoices = invRes.data || []
  const openInv = invoices.filter((i) =>
    ["sent", "overdue", "partial"].includes(String(i.status || "")),
  )
  const openSum = openInv.reduce((s, r) => s + Number(r.amount || 0), 0)
  const tips = tipsRes.data || []
  const tipsSum = tips.reduce(
    (s, t) => s + Number(t.net_amount ?? t.amount ?? 0),
    0,
  )

  return (
    <div className="flex w-full min-w-0 flex-col gap-6 p-4 md:p-6">
      <PageHeader
        eyebrow="Finance"
        title="Revenue"
        description="One place for invoices, trends, and crew tips. Choose a view below."
        meta={
          <>
            <span>Open invoices: {openInv.length}</span>
            <PageMetaDivider />
            <span>Open AR {formatCompactCurrency(openSum)}</span>
            <PageMetaDivider />
            <span>Tips recorded {formatCompactCurrency(tipsSum)}</span>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Link
              key={c.href}
              href={c.href}
              className="group flex gap-3 rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] p-4 transition-colors hover:border-[var(--yu3-wine-tint)] hover:bg-[var(--yu3-wine-wash)]/40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--yu3-r-md)] bg-[var(--yu3-bg-surface-sunken)] text-[var(--yu3-wine)] group-hover:bg-[var(--yu3-wine-tint)]">
                <Icon size={20} weight="regular" />
              </div>
              <div className="min-w-0">
                <div className="text-[14px] font-semibold text-[var(--yu3-ink-strong)] group-hover:text-[var(--yu3-wine)]">
                  {c.title}
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-[var(--yu3-ink-muted)]">
                  {c.description}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
