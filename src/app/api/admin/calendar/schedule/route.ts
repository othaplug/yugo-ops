import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createScheduleBlock } from "@/lib/calendar/conflict-check";
import { requireStaff } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const db = createAdminClient();
  const body = await req.json();
  const {
    job_type,
    crew_id,
    date,
    start,
    end,
    reference_id,
    notes,
    created_by,
    truck_id,
  } = body;

  if (!crew_id || !date || !start || !end || !job_type) {
    return NextResponse.json({ error: "crew_id, date, start, end, job_type required" }, { status: 400 });
  }

  try {
    const block = await createScheduleBlock(db, {
      crew_id,
      date,
      start,
      end,
      type: job_type,
      reference_id,
      notes,
      created_by,
    });

    if (reference_id) {
      const table = job_type === "move" ? "moves" : job_type === "delivery" ? "deliveries" : null;
      if (table) {
        await db.from(table).update({
          crew_id,
          scheduled_start: start,
          scheduled_end: end,
          assigned_truck_id: truck_id || null,
          calendar_status: "scheduled",
        }).eq("id", reference_id);
      }
    }

    return NextResponse.json({ block });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to schedule";
    const isConflict = message.startsWith("CONFLICT:");
    return NextResponse.json(
      { error: message },
      { status: isConflict ? 409 : 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const db = createAdminClient();
    const { block_id } = await req.json();

    if (!block_id) {
      return NextResponse.json({ error: "block_id required" }, { status: 400 });
    }

    const { data: block } = await db
      .from("crew_schedule_blocks")
      .select("*")
      .eq("id", block_id)
      .single();

    if (!block) {
      return NextResponse.json({ error: "Block not found" }, { status: 404 });
    }

    if (block.reference_id && block.reference_type) {
      const table = block.reference_type === "move" ? "moves" : block.reference_type === "delivery" ? "deliveries" : null;
      if (table) {
        await db.from(table).update({
          scheduled_start: null,
          scheduled_end: null,
          calendar_status: null,
        }).eq("id", block.reference_id);
      }
    }

    const { error } = await db.from("crew_schedule_blocks").delete().eq("id", block_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
