import { NextRequest, NextResponse } from "next/server"
import { requireAdmin } from "@/lib/api-auth"
import { loadRevenueForecastData } from "@/lib/admin/revenue-forecast-data"

export const dynamic = "force-dynamic"

export async function GET(_req: NextRequest) {
  const { error } = await requireAdmin()
  if (error) return error
  const data = await loadRevenueForecastData()
  return NextResponse.json(data)
}
