/**
 * Remove sample / test operational jobs (moves + deliveries) and crew artifacts.
 *
 * Also removes "ghost" crew analytics rows (client/route shown as —): completed
 * tracking_sessions whose job_id is a UUID that no longer exists on moves or deliveries,
 * with started_at (in APP_TIMEZONE) on Mar 31 / Apr 6 / Apr 11 / Apr 16 for SAMPLE_JOB_YEAR.
 *
 * Targets (calendar year from SAMPLE_JOB_YEAR, default 2026):
 *   • Placeholder deliveries on Mar 31 and Apr 6 (blank customer, client, business name)
 *   • Moves on Apr 6, Apr 11, Apr 16 (sample move days)
 *   • Legacy markers: sample-flow-test email, Sample Client name, seed note in internal_notes
 *
 * Prereqs: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *
 * Dry run:  npx tsx scripts/delete-sample-test-moves.ts
 * Apply:   npx tsx scripts/delete-sample-test-moves.ts --execute
 * Year:    SAMPLE_JOB_YEAR=2025 npx tsx scripts/delete-sample-test-moves.ts --execute
 *
 * npm run delete:sample-moves  |  npm run delete:sample-jobs
 */

import { config } from "dotenv"

config({ path: ".env.local" })

import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/** Same as crew job id resolution: generic UUID shape. */
const CREW_JOB_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MARKER_EMAIL = "sample-flow-test@example.com"
const MARKER_NAME = "Sample Client (flow test)"
const MARKER_NOTE = "seed-sample-move-today"

const year = (process.env.SAMPLE_JOB_YEAR || "2026").trim()

/** Sample moves per ops list */
const SAMPLE_MOVE_SCHEDULE_DATES = [`${year}-04-06`, `${year}-04-11`, `${year}-04-16`]

/** Sample delivery day: Mar 31 (only placeholder rows with blank names; avoids real jobs same day) */
const SAMPLE_DELIVERY_PLACEHOLDER_DATE = `${year}-03-31`

function targetLocalDates(): Set<string> {
  return new Set([
    `${year}-03-31`,
    `${year}-04-06`,
    `${year}-04-11`,
    `${year}-04-16`,
  ])
}

function isBlankName(v: string | null | undefined) {
  return v == null || String(v).trim() === ""
}

async function fetchAllPrimaryIds(
  supabase: SupabaseClient,
  table: "moves" | "deliveries",
): Promise<Set<string>> {
  const out = new Set<string>()
  const step = 1000
  for (let from = 0; ; from += step) {
    const to = from + step - 1
    const { data, error } = await supabase.from(table).select("id").range(from, to)
    if (error) throw new Error(`${table} id fetch: ${error.message}`)
    const rows = data || []
    for (const r of rows) out.add((r as { id: string }).id)
    if (rows.length < step) break
  }
  return out
}

/**
 * Completed sessions on target calendar days (in app TZ) whose job_id UUID has no move/delivery row.
 * These are what admin crew analytics shows as — for client/route.
 */
async function collectOrphanCompletedSessionsForTargets(
  supabase: SupabaseClient,
  movePk: Set<string>,
  delPk: Set<string>,
): Promise<{ sessionId: string; jobId: string; localDay: string }[]> {
  const tz = (process.env.APP_TIMEZONE || process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Toronto").trim()
  const targets = targetLocalDates()
  const fromIso = `${year}-03-20T00:00:00.000Z`
  const toIso = `${year}-04-28T23:59:59.999Z`
  const out: { sessionId: string; jobId: string; localDay: string }[] = []
  const step = 500
  for (let from = 0; ; from += step) {
    const { data, error } = await supabase
      .from("tracking_sessions")
      .select("id, job_id, started_at")
      .eq("status", "completed")
      .gte("started_at", fromIso)
      .lte("started_at", toIso)
      .range(from, from + step - 1)
    if (error) throw new Error(`tracking_sessions scan: ${error.message}`)
    const rows = data || []
    for (const s of rows) {
      const startedAt = String((s as { started_at: string }).started_at)
      const localDay = new Date(startedAt).toLocaleDateString("en-CA", { timeZone: tz })
      if (!targets.has(localDay)) continue
      const jobId = String((s as { job_id: string }).job_id ?? "").trim()
      if (!CREW_JOB_UUID_RE.test(jobId)) continue
      if (!movePk.has(jobId) && !delPk.has(jobId)) {
        out.push({ sessionId: (s as { id: string }).id, jobId, localDay })
      }
    }
    if (rows.length < step) break
  }
  return out
}

async function collectMoveIds(supabase: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>()

  const { data: byDate, error: e0 } = await supabase
    .from("moves")
    .select("id")
    .in("scheduled_date", SAMPLE_MOVE_SCHEDULE_DATES)
  if (e0) throw new Error(`moves by date: ${e0.message}`)
  for (const r of byDate || []) ids.add((r as { id: string }).id)

  const { data: byEmail, error: e1 } = await supabase
    .from("moves")
    .select("id")
    .eq("client_email", MARKER_EMAIL)
  if (e1) throw new Error(`moves by email: ${e1.message}`)
  for (const r of byEmail || []) ids.add((r as { id: string }).id)

  const { data: byName, error: e2 } = await supabase
    .from("moves")
    .select("id")
    .eq("client_name", MARKER_NAME)
  if (e2) throw new Error(`moves by name: ${e2.message}`)
  for (const r of byName || []) ids.add((r as { id: string }).id)

  const { data: byNote, error: e3 } = await supabase
    .from("moves")
    .select("id")
    .ilike("internal_notes", `%${MARKER_NOTE}%`)
  if (e3) throw new Error(`moves by note: ${e3.message}`)
  for (const r of byNote || []) ids.add((r as { id: string }).id)

  return [...ids]
}

function addPlaceholderDeliveryIds(
  rows: unknown[] | null,
  ids: Set<string>,
) {
  for (const r of rows || []) {
    const row = r as {
      id: string
      customer_name?: string | null
      client_name?: string | null
      business_name?: string | null
    }
    if (
      isBlankName(row.customer_name) &&
      isBlankName(row.client_name) &&
      isBlankName(row.business_name)
    ) {
      ids.add(row.id)
    }
  }
}

async function collectDeliveryIds(supabase: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>()

  const { data: mar31, error: e0 } = await supabase
    .from("deliveries")
    .select("id, customer_name, client_name, business_name")
    .eq("scheduled_date", SAMPLE_DELIVERY_PLACEHOLDER_DATE)
  if (e0) throw new Error(`deliveries Mar 31: ${e0.message}`)
  addPlaceholderDeliveryIds(mar31, ids)

  const { data: apr6, error: e1 } = await supabase
    .from("deliveries")
    .select("id, customer_name, client_name, business_name")
    .eq("scheduled_date", `${year}-04-06`)
  if (e1) throw new Error(`deliveries Apr 6: ${e1.message}`)
  addPlaceholderDeliveryIds(apr6, ids)

  return [...ids]
}

async function deleteOptional(
  supabase: SupabaseClient,
  table: string,
  filter: { column: string; values: string[] },
) {
  if (filter.values.length === 0) return
  const { error } = await supabase.from(table).delete().in(filter.column, filter.values)
  if (error && !String(error.message).includes("does not exist")) {
    console.warn(`[warn] ${table} delete: ${error.message}`)
  }
}

async function purgeJobArtifacts(supabase: SupabaseClient, jobIds: string[], moveIds: string[]) {
  if (jobIds.length === 0) return

  const { data: sessions, error: se } = await supabase
    .from("tracking_sessions")
    .select("id")
    .in("job_id", jobIds)
  if (se) throw new Error(`tracking_sessions select: ${se.message}`)
  const sessionIds = (sessions || []).map((s) => (s as { id: string }).id).filter(Boolean)

  if (sessionIds.length > 0) {
    const { error: lu } = await supabase.from("location_updates").delete().in("session_id", sessionIds)
    if (lu && !String(lu.message).includes("does not exist")) {
      console.warn(`[warn] location_updates: ${lu.message}`)
    }
  }

  const { error: ts } = await supabase.from("tracking_sessions").delete().in("job_id", jobIds)
  if (ts) throw new Error(`tracking_sessions delete: ${ts.message}`)

  await deleteOptional(supabase, "job_photos", { column: "job_id", values: jobIds })
  await deleteOptional(supabase, "client_sign_offs", { column: "job_id", values: jobIds })
  await deleteOptional(supabase, "incidents", { column: "job_id", values: jobIds })
  await deleteOptional(supabase, "extra_items", { column: "job_id", values: jobIds })
  await deleteOptional(supabase, "equipment_checks", { column: "job_id", values: jobIds })
  await deleteOptional(supabase, "signoff_skips", { column: "job_id", values: jobIds })

  if (moveIds.length > 0) {
    const { error: tipErr } = await supabase.from("tips").delete().in("move_id", moveIds)
    if (tipErr && !String(tipErr.message).includes("does not exist")) {
      console.warn(`[warn] tips: ${tipErr.message}`)
    }
  }
}

async function main() {
  const execute = process.argv.includes("--execute")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local")
    process.exit(1)
  }

  const supabase = createClient(url, key)

  const tz = (process.env.APP_TIMEZONE || process.env.NEXT_PUBLIC_APP_TIMEZONE || "America/Toronto").trim()

  const [movePk, delPk] = await Promise.all([
    fetchAllPrimaryIds(supabase, "moves"),
    fetchAllPrimaryIds(supabase, "deliveries"),
  ])

  const moveIds = await collectMoveIds(supabase)
  const deliveryIds = await collectDeliveryIds(supabase)
  const jobIds = [...new Set([...moveIds, ...deliveryIds].map(String))]

  const orphans = await collectOrphanCompletedSessionsForTargets(supabase, movePk, delPk)
  const orphanJobIds = [...new Set(orphans.map((o) => o.jobId))]

  if (moveIds.length === 0 && deliveryIds.length === 0 && orphans.length === 0) {
    console.log("Nothing matched for this database and SAMPLE_JOB_YEAR.")
    console.log(`  Move dates: ${SAMPLE_MOVE_SCHEDULE_DATES.join(", ")}`)
    console.log(`  Placeholder deliveries: ${SAMPLE_DELIVERY_PLACEHOLDER_DATE} and ${year}-04-06`)
    console.log(
      `  Orphan sessions: completed, local day in ${[...targetLocalDates()].join(", ")} (${tz}), job_id UUID not in moves/deliveries`,
    )
    console.log(`  Year: ${year} (try SAMPLE_JOB_YEAR=2025 if your jobs are last year)`)
    return
  }

  const { data: moveRows } = await supabase
    .from("moves")
    .select("id, move_code, client_name, scheduled_date")
    .in("id", moveIds)
  const { data: delRows } = await supabase
    .from("deliveries")
    .select("id, delivery_number, customer_name, client_name, scheduled_date")
    .in("id", deliveryIds)

  console.log(`Sample job year: ${year} (timezone for orphan day bucketing: ${tz})`)
  console.log(`Moves to remove (${moveIds.length}):`)
  for (const m of moveRows || []) {
    const r = m as {
      id: string
      move_code?: string | null
      client_name?: string | null
      scheduled_date?: string | null
    }
    console.log(
      `  move  ${r.move_code ?? r.id} | ${r.client_name ?? ""} | ${r.scheduled_date ?? ""} | id=${r.id}`,
    )
  }
  console.log(`Deliveries to remove (${deliveryIds.length}):`)
  for (const d of delRows || []) {
    const r = d as {
      id: string
      delivery_number?: string | null
      customer_name?: string | null
      client_name?: string | null
      scheduled_date?: string | null
    }
    console.log(
      `  del   ${r.delivery_number ?? r.id} | ${r.customer_name ?? ""} ${r.client_name ? `(${r.client_name})` : ""} | ${r.scheduled_date ?? ""} | id=${r.id}`,
    )
  }

  console.log(`Orphan tracking_sessions to remove (${orphans.length}) — cause "—" in crew job history:`)
  for (const o of orphans) {
    console.log(`  session ${o.sessionId} | job_id=${o.jobId} | local_day=${o.localDay}`)
  }

  if (!execute) {
    console.log("\nDry run. Re-run with --execute to apply.")
    process.exit(0)
  }

  if (jobIds.length > 0) {
    await purgeJobArtifacts(supabase, jobIds, moveIds)
  }

  if (moveIds.length > 0) {
    const { error: me } = await supabase.from("moves").delete().in("id", moveIds)
    if (me) {
      console.error("Delete moves failed:", me.message)
      process.exit(1)
    }
  }
  if (deliveryIds.length > 0) {
    const { error: de } = await supabase.from("deliveries").delete().in("id", deliveryIds)
    if (de) {
      console.error("Delete deliveries failed:", de.message)
      process.exit(1)
    }
  }

  if (orphanJobIds.length > 0) {
    await purgeJobArtifacts(supabase, orphanJobIds, [])
  }

  console.log(
    `\nDone. Removed ${moveIds.length} move(s), ${deliveryIds.length} delivery(ies), and ${orphans.length} orphan session(s) (artifacts purged where applicable).`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
