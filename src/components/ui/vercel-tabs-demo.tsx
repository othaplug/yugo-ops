"use client"

import { useState } from "react"

import { type Tab, Tabs } from "@/components/ui/vercel-tabs"

const demoTabs: Tab[] = [
  { id: "overview", label: "Overview" },
  { id: "integrations", label: "Integrations" },
  { id: "activity", label: "Activity" },
  { id: "domains", label: "Domains" },
  { id: "usage", label: "Usage" },
  { id: "monitoring", label: "Monitoring" },
]

const VercelTabsDemo = () => {
  const [lastId, setLastId] = useState(demoTabs[0]!.id)

  return (
    <div className="flex min-h-screen w-full items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-4 text-center">
        <Tabs
          onTabChange={(tabId) => {
            setLastId(tabId)
          }}
          tabs={demoTabs}
        />
        <p className="text-muted-foreground text-sm" aria-live="polite">
          Active: <span className="text-foreground font-medium">{lastId}</span>
        </p>
      </div>
    </div>
  )
}

export default VercelTabsDemo
