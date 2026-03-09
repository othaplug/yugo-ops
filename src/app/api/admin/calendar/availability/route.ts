import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkCrewConflict } from "@/lib/calendar/conflict-check";
import { requireStaff } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const db = createAdminClient();
    const params = req.nextUrl.searchParams;
    const crewId = params.get("crew_id");
    const date = params.get("date");

    if (!crewId || !date) {
      return NextResponse.json({ error: "crew_id and date required" }, { status: 400 });
    }

    const { data: blocks } = await db
      .from("crew_schedule_blocks")
      .select("*")
      .eq("crew_id", crewId)
      .eq("block_date", date)
      .order("block_start");

    const DAY_START = "06:00";
    const DAY_END = "20:00";

    const sortedBlocks = (blocks || []).sort((a, b) => a.block_start.localeCompare(b.block_start));
    const availableSlots: { start: string; end: string }[] = [];
    let cursor = DAY_START;
    for (const b of sortedBlocks) {
      if (cursor < b.block_start) {
        availableSlots.push({ start: cursor, end: b.block_start });
      }
      if (b.block_end > cursor) cursor = b.block_end;
    }
    if (cursor < DAY_END) {
      availableSlots.push({ start: cursor, end: DAY_END });
    }

    const totalMinutes = 14 * 60;
    let bookedMinutes = 0;
    for (const b of sortedBlocks) {
      const [sh, sm] = b.block_start.split(":").map(Number);
      const [eh, em] = b.block_end.split(":").map(Number);
      bookedMinutes += (eh * 60 + em) - (sh * 60 + sm);
    }
    const utilizationPercent = Math.round((bookedMinutes / totalMinutes) * 100);

    return NextResponse.json({
      blocks: blocks || [],
      availableSlots,
      utilizationPercent,
      bookedHours: Math.round((bookedMinutes / 60) * 10) / 10,
      totalHours: 14,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const db = createAdminClient();
    const body = await req.json();
    const { crew_id, date, start, end, exclude_block_id } = body;

    if (!crew_id || !date || !start || !end) {
      return NextResponse.json({ error: "crew_id, date, start, end required" }, { status: 400 });
    }

    const result = await checkCrewConflict(db, { crew_id, date, start, end }, exclude_block_id);

    const otherCrews: { id: string; name: string }[] = [];
    if (result.hasConflict) {
      const { data: allCrews } = await db.from("crews").select("id, name").eq("is_active", true);
      for (const crew of allCrews || []) {
        if (crew.id === crew_id) continue;
        const check = await checkCrewConflict(db, { crew_id: crew.id, date, start, end });
        if (!check.hasConflict) {
          otherCrews.push({ id: crew.id, name: crew.name });
        }
      }
    }

    return NextResponse.json({ ...result, availableCrews: otherCrews });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
