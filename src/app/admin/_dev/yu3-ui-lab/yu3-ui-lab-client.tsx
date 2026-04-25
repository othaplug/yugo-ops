"use client"

import { PageHeader } from "@/design-system/admin/layout"
import AnimatedTableRowsDemo from "@/components/ui/animated-table-rows-demo"
import { ContactsTable } from "@/components/ui/contacts-table-with-modal"
import { InteractiveLogsTable } from "@/components/ui/interactive-logs-table-shadcnui"
import { LeadsTable } from "@/components/ui/leads-data-table"
import LoaderOne from "@/components/ui/loader-one"
import PillMorphTabs from "@/components/ui/pill-morph-tabs"
import { Tabs as VercelTabs } from "@/components/ui/vercel-tabs"
import { cn } from "@/lib/utils"

const vercelTabItems = [
  { id: "overview", label: "Overview" },
  { id: "integrations", label: "Integrations" },
  { id: "activity", label: "Activity" },
]

const sectionCard = cn(
  "overflow-hidden rounded-2xl border border-[var(--yu3-line)]",
  "bg-[var(--yu3-bg-surface)] shadow-[var(--yu3-shadow-sm)]"
)

const sectionInner = "p-5 md:p-6"
const subLabel = "yu3-t-eyebrow mb-3"

const Yu3UiLabClient = () => {
  return (
    <div className="yu3-t-body mx-auto w-full max-w-[var(--yu3-content-max-w)] space-y-10 px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        description="Shadcn-based building blocks, restyled to use --yu3-* tokens. Development only."
        eyebrow="Design system"
        title="Yugo+ integrated UI (v3)"
      />

      <section className={sectionCard}>
        <div className="border-b border-[var(--yu3-line)] bg-[var(--yu3-bg-surface-sunken)] px-5 py-3">
          <p className={subLabel}>Loaders</p>
          <h2 className="yu3-t-title text-[var(--yu3-ink-strong)]">Loader one</h2>
        </div>
        <div className={cn(sectionInner, "flex min-h-[120px] items-center justify-center")}>
          <LoaderOne />
        </div>
      </section>

      <section className={sectionCard}>
        <div className="border-b border-[var(--yu3-line)] bg-[var(--yu3-bg-surface-sunken)] px-5 py-3">
          <p className={subLabel}>Tabs</p>
          <h2 className="yu3-t-title text-[var(--yu3-ink-strong)]">Pill morph tabs</h2>
        </div>
        <div className={sectionInner}>
          <PillMorphTabs
            className="max-w-xl"
            defaultValue="overview"
            items={[
              {
                value: "overview",
                label: "Overview",
                panel: (
                  <p className="text-[var(--yu3-ink-muted)] text-sm">
                    Content uses wine and forest tints in the track.
                  </p>
                ),
              },
              {
                value: "features",
                label: "Features",
                panel: <p className="text-sm">Features panel</p>,
              },
            ]}
          />
        </div>
      </section>

      <section className={sectionCard}>
        <div className="border-b border-[var(--yu3-line)] bg-[var(--yu3-bg-surface-sunken)] px-5 py-3">
          <p className={subLabel}>Tabs</p>
          <h2 className="yu3-t-title text-[var(--yu3-ink-strong)]">Vercel style tabs</h2>
        </div>
        <div className={cn(sectionInner, "flex justify-center")}>
          <VercelTabs tabs={vercelTabItems} />
        </div>
      </section>

      <section className={sectionCard}>
        <div className="border-b border-[var(--yu3-line)] bg-[var(--yu3-bg-surface-sunken)] px-5 py-3">
          <p className={subLabel}>Tables</p>
          <h2 className="yu3-t-title text-[var(--yu3-ink-strong)]">
            Leads data table (sample data)
          </h2>
        </div>
        <div className="p-3 md:p-4">
          <LeadsTable className="max-w-none" />
        </div>
      </section>

      <section className={sectionCard}>
        <div className="border-b border-[var(--yu3-line)] bg-[var(--yu3-bg-surface-sunken)] px-5 py-3">
          <p className={subLabel}>Tables</p>
          <h2 className="yu3-t-title text-[var(--yu3-ink-strong)]">Contacts (modal)</h2>
        </div>
        <div className="p-2 md:p-3">
          <div className="max-h-[560px] overflow-y-auto pr-1">
            <ContactsTable
              className="max-w-none"
              title="Person"
            />
          </div>
        </div>
      </section>

      <section className={sectionCard}>
        <div className="border-b border-[var(--yu3-line)] bg-[var(--yu3-bg-surface-sunken)] px-5 py-3">
          <p className={subLabel}>Tables</p>
          <h2 className="yu3-t-title text-[var(--yu3-ink-strong)]">
            Animated table rows (delete row)
          </h2>
        </div>
        <div className="p-2 md:p-3">
          <AnimatedTableRowsDemo />
        </div>
      </section>

      <section className={sectionCard}>
        <div className="border-b border-[var(--yu3-line)] bg-[var(--yu3-bg-surface-sunken)] px-5 py-3">
          <p className={subLabel}>Logs</p>
          <h2 className="yu3-t-title text-[var(--yu3-ink-strong)]">
            Interactive logs (shadcn)
          </h2>
        </div>
        <div className="h-[min(90vh,720px)] min-h-[480px]">
          <InteractiveLogsTable className="h-full" />
        </div>
      </section>
    </div>
  )
}

export { Yu3UiLabClient }
