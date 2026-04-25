"use client"

import Link from "next/link"
import { ChartBar, Lightning } from "@/design-system/admin/icons"
import { Tabs, TabsList, TabsTrigger } from "@/design-system/admin/primitives"

export function LeadsNavTabs({
  active,
}: {
  active: "dashboard" | "all" | "mine" | "widget"
}) {
  return (
    <Tabs value={active}>
      <TabsList variant="pill">
        <TabsTrigger value="dashboard" variant="pill" asChild>
          <Link href="/admin/leads">
            <ChartBar size={12} />
            Dashboard
          </Link>
        </TabsTrigger>
        <TabsTrigger value="all" variant="pill" asChild>
          <Link href="/admin/leads/all">All leads</Link>
        </TabsTrigger>
        <TabsTrigger value="mine" variant="pill" asChild>
          <Link href="/admin/leads/mine">My leads</Link>
        </TabsTrigger>
        <TabsTrigger value="widget" variant="pill" asChild>
          <Link href="/admin/leads/widget">
            <Lightning size={12} />
            Widget
          </Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
