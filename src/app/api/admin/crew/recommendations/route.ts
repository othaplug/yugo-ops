import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { recommendCrew } from "@/lib/crew/recommendation";

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const p = req.nextUrl.searchParams;

  const move = {
    service_type:   p.get("serviceType"),
    tier_selected:  p.get("tierSelected"),
    has_piano:      p.get("hasPiano") === "true",
    has_art:        p.get("hasArt") === "true",
    has_antiques:   p.get("hasAntiques") === "true",
    estimate:       p.get("estimate") ? Number(p.get("estimate")) : null,
  };

  const moveDate = p.get("moveDate");

  const recommendations = await recommendCrew(move, moveDate);

  return NextResponse.json({ data: recommendations });
}
