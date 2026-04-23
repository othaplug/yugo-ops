import { NextResponse } from "next/server"
import { requireStaff } from "@/lib/api-auth"
import { getAdminUniverse } from "@/lib/admin-v2/data/server"

export const dynamic = "force-dynamic"

/** Lightweight search/command-palette endpoint for `/admin-v2`. Returns the
 * same aggregated universe the server pages render off of. */
export async function GET() {
  const { error } = await requireStaff()
  if (error) return error

  const universe = await getAdminUniverse()
  return NextResponse.json({
    meta: universe.meta,
    leads: universe.leads.map(({ id, name, email, status, source }) => ({
      id,
      name,
      email,
      status,
      source,
    })),
    quotes: universe.quotes.map(({ id, number, customerName, status }) => ({
      id,
      number,
      customerName,
      status,
    })),
    moves: universe.moves.map(({ id, number, customerName, status }) => ({
      id,
      number,
      customerName,
      status,
    })),
    customers: universe.customers.map(({ id, name, email, type }) => ({
      id,
      name,
      email,
      type,
    })),
    invoices: universe.invoices.map(({ id, number, customerName, status }) => ({
      id,
      number,
      customerName,
      status,
    })),
    crew: universe.crew.map(({ id, name, role }) => ({ id, name, role })),
  })
}
