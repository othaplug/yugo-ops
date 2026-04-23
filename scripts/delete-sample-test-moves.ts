/**
 * Remove moves created by `seed-sample-move-today` (or matching the same markers).
 *
 * Prereqs: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * By default, lists matching rows and exits. Pass --execute to delete.
 * Usage: npx tsx scripts/delete-sample-test-moves.ts
 *        npx tsx scripts/delete-sample-test-moves.ts --execute
 */

import { config } from "dotenv"

config({ path: ".env.local" })

import { createClient } from "@supabase/supabase-js"

const MARKER_EMAIL = "sample-flow-test@example.com"
const MARKER_NAME = "Sample Client (flow test)"
const MARKER_NOTE = "seed-sample-move-today"

async function main() {
  const execute = process.argv.includes("--execute")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
  }

  const supabase = createClient(url, key)
  const ids = new Set<string>()

  const { data: byEmail, error: e1 } = await supabase
    .from("moves")
    .select("id, move_code, client_name, scheduled_date")
    .eq("client_email", MARKER_EMAIL)
  if (e1) {
    console.error("Query by email failed:", e1.message)
    process.exit(1)
  }
  for (const r of byEmail || []) ids.add((r as { id: string }).id)

  const { data: byName, error: e2 } = await supabase
    .from("moves")
    .select("id, move_code, client_name, scheduled_date")
    .eq("client_name", MARKER_NAME)
  if (e2) {
    console.error("Query by name failed:", e2.message)
    process.exit(1)
  }
  for (const r of byName || []) ids.add((r as { id: string }).id)

  const { data: byNote, error: e3 } = await supabase
    .from("moves")
    .select("id, move_code, client_name, scheduled_date, internal_notes")
    .ilike("internal_notes", `%${MARKER_NOTE}%`)
  if (e3) {
    console.error("Query by internal_notes failed:", e3.message)
    process.exit(1)
  }
  for (const r of byNote || []) ids.add((r as { id: string }).id)

  if (ids.size === 0) {
    console.log("No sample test moves found (by email, name, or internal_notes marker).")
    return
  }

  const idArrPre = [...ids]
  const { data: list, error: e4 } = await supabase
    .from("moves")
    .select("id, move_code, client_name, scheduled_date")
    .in("id", idArrPre)
  if (e4) {
    console.error("Query by id list failed:", e4.message)
    process.exit(1)
  }
  const rows = (list || []) as {
    id: string
    move_code?: string | null
    client_name?: string | null
    scheduled_date?: string | null
  }[]

  console.log(`Found ${rows.length} move(s) to remove:`)
  for (const m of rows) {
    console.log(
      `  - ${m.move_code ?? m.id} | ${m.client_name ?? ""} | ${m.scheduled_date ?? ""} | id=${m.id}`,
    )
  }

  if (!execute) {
    console.log("\nDry run. Re-run with --execute to delete these rows from public.moves.")
    process.exit(0)
  }

  const { error: delErr } = await supabase.from("moves").delete().in("id", idArrPre)
  if (delErr) {
    console.error("Delete failed:", delErr.message)
    console.error("If a foreign key blocked the delete, remove dependent rows or use the Supabase SQL editor with CASCADE for your schema.")
    process.exit(1)
  }

  console.log(`\nDeleted ${idArrPre.length} move(s).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
