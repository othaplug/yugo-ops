import { createAdminClient } from "@/lib/supabase/admin"
import CreateMoveForm from "@/app/admin/moves/new/CreateMoveForm"

export const metadata = { title: "New move" }
export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AdminV2NewMovePage() {
  const db = createAdminClient()
  const [{ data: orgs }, { data: crews }, { data: itemWeights }] = await Promise.all([
    db
      .from("organizations")
      .select("id, name, type, email, contact_name, phone, address")
      .eq("type", "b2c")
      .not("name", "like", "\\_%")
      .order("name"),
    db.from("crews").select("id, name, members").order("name"),
    db
      .from("item_weights")
      .select("slug, item_name, weight_score, category, room, is_common, display_order, active, num_people_min")
      .eq("active", true)
      .order("display_order"),
  ])

  return (
    <div className="mx-0 w-full max-w-none px-4 py-4 sm:px-5 md:px-8 md:py-6 lg:px-10">
      <CreateMoveForm
        organizations={orgs || []}
        crews={crews || []}
        itemWeights={itemWeights || []}
      />
    </div>
  )
}
