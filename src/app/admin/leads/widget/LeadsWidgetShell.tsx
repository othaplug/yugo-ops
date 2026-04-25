"use client"

import { PageHeader } from "@/design-system/admin/layout/PageHeader"
import { LeadsNavTabs } from "../LeadsNavTabs"

export function LeadsWidgetShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full min-w-0 flex-col">
      <div className="px-4 pt-4 md:px-6">
        <PageHeader
          eyebrow="Leads"
          title="Widget leads"
          description="Inquiries that came in through the website widget. Open the CRM list for the full pipeline."
        />
        <div className="mt-3">
          <LeadsNavTabs active="widget" />
        </div>
      </div>
      {children}
    </div>
  )
}
