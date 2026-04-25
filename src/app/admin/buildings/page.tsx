import { createAdminClient } from "@/lib/supabase/admin"
import BuildingsAdminClient from "./BuildingsAdminClient"
import type { BuildingProfileRow } from "@/lib/buildings/types"

export const metadata = { title: "Buildings" }
export const dynamic = "force-dynamic"

export default async function AdminBuildingsPage() {
  const db = createAdminClient()
  const { data } = await db
    .from("building_profiles")
    .select("*")
    .order("complexity_rating", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(400)

  return <BuildingsAdminClient initial={(data ?? []) as BuildingProfileRow[]} />
}
