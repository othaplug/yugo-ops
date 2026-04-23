import * as React from "react"
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
} from "./seed"
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
} from "./types"

// Deterministic fixture universe. Generated once per process; consumers
// read via hooks below. When we swap to Supabase, these become the
// canonical sample data for Storybook + tests only.

export type MockUniverse = {
  leads: Lead[]
  customers: Customer[]
  crew: CrewMember[]
  moves: Move[]
  quotes: Quote[]
  invoices: Invoice[]
  b2bPartners: B2BPartner[]
  pmAccounts: PMAccount[]
  buildings: Building[]
}

let cached: MockUniverse | null = null

export const getMockUniverse = (): MockUniverse => {
  if (cached) return cached
  const customers = generateCustomers()
  const crew = generateCrew()
  const moves = generateMoves(customers, crew)
  const invoices = generateInvoices(moves)
  const pmAccounts = generatePMAccounts()
  const buildings = generateBuildings(pmAccounts)
  const quotes = generateQuotes(customers)
  const b2bPartners = generateB2BPartners()
  const leads = generateLeads()
  cached = {
    customers,
    crew,
    moves,
    invoices,
    pmAccounts,
    buildings,
    quotes,
    b2bPartners,
    leads,
  }
  return cached
}

export const useMockUniverse = () => React.useMemo(() => getMockUniverse(), [])

export * from "./types"
