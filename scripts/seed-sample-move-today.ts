/**
 * Insert a sample move scheduled for today (app timezone) so it appears on
 * admin Moves and the crew dashboard for the assigned team.
 *
 * Prereqs: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Crew: run `npm run seed:crew` first so a team and PIN login exist (phone 6475550123, PIN 123456).
 *
 * Usage: npx tsx scripts/seed-sample-move-today.ts
 * Optional: CREW_PHONE=6475550123 (default) to assign to that member's team.
 */

import { config } from "dotenv"

config({ path: ".env.local" })

import { createClient } from "@supabase/supabase-js"
import { getAppTimezone, getTodayString } from "@/lib/business-timezone"

const TEMPLATE_ORG_ID = "b0000000-0000-0000-0000-000000000001"

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
  }

  const supabase = createClient(url, key)
  const tz = getAppTimezone()
  const today = getTodayString(tz)

  const phone = (process.env.CREW_PHONE || "6475550123").trim()
  const { data: member } = await supabase
    .from("crew_members")
    .select("id, team_id, name")
    .eq("phone", phone)
    .eq("is_active", true)
    .maybeSingle()

  let teamId = member?.team_id as string | undefined
  let crewName: string | null = null

  if (!teamId) {
    const { data: crews } = await supabase.from("crews").select("id, name").order("name").limit(1)
    if (!crews?.length) {
      console.error("No crew found. Add a team in admin or run: npm run seed:crew")
      process.exit(1)
    }
    teamId = crews[0].id
    crewName = crews[0].name ?? null
    console.warn(`No active crew_members row for phone ${phone}; using first crew: ${crewName ?? teamId}`)
  } else {
    const { data: crew } = await supabase.from("crews").select("name").eq("id", teamId).single()
    crewName = crew?.name ?? null
  }

  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name")
    .neq("id", TEMPLATE_ORG_ID)
    .order("created_at", { ascending: true })
    .limit(1)

  const organizationId = orgs?.[0]?.id ?? TEMPLATE_ORG_ID
  if (!orgs?.[0]) {
    console.warn(`Using template organization ${TEMPLATE_ORG_ID} (no other org row found).`)
  }

  const clientName = "Sample Client (flow test)"
  const payload = {
    organization_id: organizationId,
    crew_id: teamId,
    assigned_crew_name: crewName,
    client_name: clientName,
    client_email: "sample-flow-test@example.com",
    client_phone: "4165550100",
    from_address: "100 Queen St W, Toronto, ON",
    to_address: "200 Bay St, Toronto, ON",
    delivery_address: "200 Bay St, Toronto, ON",
    scheduled_date: today,
    scheduled_time: "9:00 AM",
    arrival_window: "Morning (8:00 AM – 10:00 AM)",
    status: "confirmed",
    stage: "scheduled",
    move_type: "residential",
    service_type: "local_move",
    amount: 1850,
    estimate: 1850,
    internal_notes: "Sample move for admin and crew flow testing (seed-sample-move-today).",
  }

  const { data: move, error } = await supabase.from("moves").insert(payload).select("id, move_code, scheduled_date, crew_id").single()

  if (error || !move) {
    console.error("Insert failed:", error?.message ?? error)
    process.exit(1)
  }

  const { count: memberCount } = await supabase
    .from("crew_members")
    .select("id", { count: "exact", head: true })
    .eq("team_id", move.crew_id)
    .eq("is_active", true)

  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(/\/$/, "")
  const jobId = move.move_code || move.id

  console.log("")
  console.log("Sample move created.")
  console.log(`  Timezone: ${tz}`)
  console.log(`  scheduled_date: ${move.scheduled_date} (crew dashboard uses this as "today")`)
  console.log(`  move_code: ${move.move_code}`)
  console.log(`  id: ${move.id}`)
  console.log(`  Active crew members on this team: ${memberCount ?? 0} (need at least 1 to use /crew/login)`)
  console.log("")
  console.log("Open in admin:")
  console.log(`  ${base}/admin/moves/${move.id}`)
  console.log("")
  console.log("Crew dashboard (log in with your seeded crew PIN, same team as crew_id):")
  console.log(`  ${base}/crew/dashboard`)
  console.log(`  Job detail: ${base}/crew/dashboard/job/move/${jobId}`)
  console.log("")
}

main()
