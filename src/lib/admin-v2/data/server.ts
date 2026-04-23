import "server-only"
import { cache } from "react"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  mapB2BPartner,
  mapBuilding,
  mapCrewMember,
  mapCustomer,
  mapInvoice,
  mapLead,
  mapMove,
  mapPMAccount,
  mapQuote,
  type LeadRow,
  type QuoteRow,
  type MoveRow,
  type CustomerRow,
  type InvoiceRow,
  type CrewMemberRow,
  type OrganizationRow,
  type BuildingRow,
} from "./mappers"
import {
  generateB2BPartners,
  generateBuildings,
  generateCrew,
  generateCustomers,
  generateInvoices,
  generateLeads,
  generateMoves,
  generatePMAccounts,
  generateQuotes,
} from "../mock/seed"
import type {
  B2BPartner,
  Building,
  CrewMember,
  Customer,
  Invoice,
  Lead,
  Move,
  PMAccount,
  Quote,
} from "../mock/types"

export type AdminUniverse = {
  leads: Lead[]
  customers: Customer[]
  crew: CrewMember[]
  moves: Move[]
  quotes: Quote[]
  invoices: Invoice[]
  b2bPartners: B2BPartner[]
  pmAccounts: PMAccount[]
  buildings: Building[]
  meta: { source: "live" | "mock"; fetchedAt: string; error?: string }
}

const LIMIT = 500

type Bucket<T> = { rows: T[] | null; error: string | null }

type QueryResult<T> = { data: T[] | null; error: { message: string } | null }

/** Runs a Supabase query and returns `{ rows, error }` without throwing. */
const tryQuery = async <T>(
  run: () => PromiseLike<QueryResult<T>>,
): Promise<Bucket<T>> => {
  try {
    const { data, error } = await run()
    if (error) return { rows: null, error: error.message }
    return { rows: data ?? [], error: null }
  } catch (e) {
    return {
      rows: null,
      error: e instanceof Error ? e.message : "Query failed",
    }
  }
}

const mockUniverse = (reason: string): AdminUniverse => {
  const customers = generateCustomers()
  const crew = generateCrew()
  const moves = generateMoves(customers, crew)
  const invoices = generateInvoices(moves)
  const pmAccounts = generatePMAccounts()
  const buildings = generateBuildings(pmAccounts)
  const quotes = generateQuotes(customers)
  const b2bPartners = generateB2BPartners()
  const leads = generateLeads()
  return {
    leads,
    customers,
    crew,
    moves,
    invoices,
    pmAccounts,
    buildings,
    quotes,
    b2bPartners,
    meta: { source: "mock", fetchedAt: new Date().toISOString(), error: reason },
  }
}

/** Live Supabase fetch with graceful fallback to mock on env/query failure. */
const fetchAdminUniverse = async (): Promise<AdminUniverse> => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return mockUniverse("Missing SUPABASE_SERVICE_ROLE_KEY")
  }

  let db: ReturnType<typeof createAdminClient>
  try {
    db = createAdminClient()
  } catch (e) {
    return mockUniverse(e instanceof Error ? e.message : "Supabase init failed")
  }

  const [
    leadsResp,
    quotesResp,
    movesResp,
    contactsResp,
    organizationsResp,
    invoicesResp,
    crewResp,
    buildingsResp,
  ] = await Promise.all([
    tryQuery<LeadRow>(() =>
      db
        .from("leads")
        .select(
          "id, lead_number, first_name, last_name, email, phone, source, source_detail, status, priority, completeness_score, estimated_value, created_at, first_response_at, assigned_to",
        )
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    ),
    tryQuery<QuoteRow>(() =>
      db
        .from("quotes")
        .select(
          "id, quote_id, quote_number, contact_id, client_name, client_email, service_type, tier_selected, status, custom_price, tiers, sent_at, viewed_at, accepted_at, created_at, expires_at",
        )
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    ),
    tryQuery<MoveRow>(() =>
      db
        .from("moves")
        .select(
          "id, move_code, client_name, client_email, contact_id, from_address, to_address, scheduled_date, estimate, status, move_type, service_type, tier_selected, crew_id, created_at, margin_percent",
        )
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    ),
    tryQuery<CustomerRow>(() =>
      db
        .from("contacts")
        .select("id, name, email, phone, created_at")
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    ),
    tryQuery<OrganizationRow>(() =>
      db
        .from("organizations")
        .select(
          "id, name, type, vertical, primary_contact_name, primary_contact_email, primary_contact_phone, contract_status, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    ),
    tryQuery<InvoiceRow>(() =>
      db
        .from("invoices")
        .select(
          "id, invoice_number, client_name, organization_id, move_id, amount, status, created_at, updated_at, paid_at",
        )
        .order("created_at", { ascending: false })
        .limit(LIMIT),
    ),
    tryQuery<CrewMemberRow>(() =>
      db
        .from("crew_members")
        .select("id, name, email, phone, role, is_active, created_at")
        .order("name", { ascending: true })
        .limit(LIMIT),
    ),
    tryQuery<BuildingRow>(() =>
      db
        .from("buildings")
        .select(
          "id, name, address, pm_account_id, elevator_config, complexity, moves_completed, last_move_at",
        )
        .order("name", { ascending: true })
        .limit(LIMIT),
    ),
  ])

  const errors = [
    leadsResp.error,
    quotesResp.error,
    movesResp.error,
    contactsResp.error,
    organizationsResp.error,
    invoicesResp.error,
    crewResp.error,
    buildingsResp.error,
  ].filter(Boolean) as string[]

  if (
    !leadsResp.rows &&
    !quotesResp.rows &&
    !movesResp.rows &&
    !invoicesResp.rows
  ) {
    return mockUniverse(`All queries failed: ${errors[0] ?? "unknown"}`)
  }

  // Build join maps once so we can attach names without N+1 fetches.
  const contactNameById = new Map<string, string>()
  for (const contact of contactsResp.rows ?? []) {
    contactNameById.set(contact.id, contact.name ?? "")
  }

  const orgNameById = new Map<string, string>()
  for (const org of organizationsResp.rows ?? []) {
    orgNameById.set(org.id, org.name ?? "")
  }

  const crewRows = crewResp.rows ?? []
  const crewById = new Map<string, { id: string; name: string }>()
  for (const member of crewRows) {
    crewById.set(member.id, { id: member.id, name: member.name ?? "Crew" })
  }

  const leads: Lead[] = (leadsResp.rows ?? []).map((row) => mapLead(row))
  const quotes: Quote[] = (quotesResp.rows ?? []).map((row) =>
    mapQuote(row, contactNameById.get(row.contact_id ?? "")),
  )
  const moves: Move[] = (movesResp.rows ?? []).map((row) =>
    mapMove(row, crewById),
  )
  const invoices: Invoice[] = (invoicesResp.rows ?? []).map((row) => mapInvoice(row))
  const crew: CrewMember[] = crewRows.map((row) => mapCrewMember(row))

  // Per-contact aggregates for LTV/moves count.
  const statsByCustomer = new Map<
    string,
    { ltv: number; movesCount: number; lastContactAt: string | null }
  >()
  for (const move of moves) {
    if (!move.customerId) continue
    const existing = statsByCustomer.get(move.customerId) ?? {
      ltv: 0,
      movesCount: 0,
      lastContactAt: null,
    }
    existing.movesCount += 1
    existing.ltv += move.total
    if (!existing.lastContactAt || move.scheduledAt > existing.lastContactAt) {
      existing.lastContactAt = move.scheduledAt
    }
    statsByCustomer.set(move.customerId, existing)
  }
  for (const invoice of invoices) {
    if (!invoice.customerId) continue
    const existing = statsByCustomer.get(invoice.customerId) ?? {
      ltv: 0,
      movesCount: 0,
      lastContactAt: null,
    }
    existing.ltv += invoice.total
    statsByCustomer.set(invoice.customerId, existing)
  }

  const customers: Customer[] = (contactsResp.rows ?? []).map((row) =>
    mapCustomer(row, statsByCustomer.get(row.id)),
  )

  const organizations = organizationsResp.rows ?? []
  const b2bOrgs = organizations.filter(
    (o) => (o.type ?? "").toLowerCase() !== "pm",
  )
  const pmOrgs = organizations.filter(
    (o) => (o.type ?? "").toLowerCase() === "pm",
  )

  const b2bStats = new Map<string, { jobsLast30: number; revenueLast30: number }>()
  const thirtyDays = Date.now() - 30 * 24 * 60 * 60 * 1000
  for (const invoice of invoices) {
    if (!invoice.customerId) continue
    if (new Date(invoice.createdAt).getTime() < thirtyDays) continue
    const existing = b2bStats.get(invoice.customerId) ?? {
      jobsLast30: 0,
      revenueLast30: 0,
    }
    existing.jobsLast30 += 1
    existing.revenueLast30 += invoice.total
    b2bStats.set(invoice.customerId, existing)
  }

  const b2bPartners: B2BPartner[] = b2bOrgs.map((org) =>
    mapB2BPartner(org, b2bStats.get(org.id)),
  )

  // PM accounts + buildings + move stats per account.
  const buildingsRaw = buildingsResp.rows ?? []
  const pmBuildingCount = new Map<string, number>()
  for (const building of buildingsRaw) {
    if (!building.pm_account_id) continue
    pmBuildingCount.set(
      building.pm_account_id,
      (pmBuildingCount.get(building.pm_account_id) ?? 0) + 1,
    )
  }

  const pmAccounts: PMAccount[] = pmOrgs.map((org) =>
    mapPMAccount(org, {
      buildings: pmBuildingCount.get(org.id) ?? 0,
    }),
  )

  const buildings: Building[] = buildingsRaw.map((row) =>
    mapBuilding({
      ...row,
      pm_account_name: row.pm_account_id
        ? orgNameById.get(row.pm_account_id) ?? null
        : null,
    }),
  )

  return {
    leads,
    customers,
    crew,
    moves,
    quotes,
    invoices,
    b2bPartners,
    pmAccounts,
    buildings,
    meta: {
      source: "live",
      fetchedAt: new Date().toISOString(),
      error: errors.length ? errors[0] : undefined,
    },
  }
}


/** Request-scoped memoized variant so all `/admin-v2` pages share one fetch. */
export const getAdminUniverse = cache(fetchAdminUniverse)
