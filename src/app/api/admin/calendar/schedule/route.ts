import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createScheduleBlock, checkCrewConflict } from "@/lib/calendar/conflict-check";
import { requireStaff } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** PATCH: Reschedule an event (move, delivery, blocked, or recurring) to a new time and/or team */
export async function PATCH(req: NextRequest) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const db = createAdminClient();
  const body = await req.json();
  const { event_id, event_type, crew_id, date, start, end } = body;

  if (!event_id || !event_type || !crew_id || !date || !start || !end) {
    return NextResponse.json(
      { error: "event_id, event_type, crew_id, date, start, end required" },
      { status: 400 }
    );
  }

  const validTypes = ["move", "delivery", "blocked"];
  if (!validTypes.includes(event_type)) {
    return NextResponse.json(
      { error: "event_type must be move, delivery, or blocked" },
      { status: 400 }
    );
  }

  try {
    // Recurring events: event_id = "recurring-{scheduleId}-{date}"
    const recurringMatch = String(event_id).match(/^recurring-([0-9a-f-]{36})-(\d{4}-\d{2}-\d{2})$/i);
    if (recurringMatch) {
      const [, scheduleId, instanceDate] = recurringMatch;
      const { error } = await db
        .from("recurring_delivery_schedules")
        .update({ crew_id })
        .eq("id", scheduleId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    // Non-UUID event_id (e.g. malformed) — reject early
    if (!UUID_REGEX.test(String(event_id))) {
      return NextResponse.json(
        { error: "Invalid event ID format." },
        { status: 400 }
      );
    }

    let excludeBlockId: string | undefined;

    if (event_type === "blocked") {
      const { data: block } = await db
        .from("crew_schedule_blocks")
        .select("id")
        .eq("id", event_id)
        .single();

      if (!block) {
        return NextResponse.json({ error: "Block not found" }, { status: 404 });
      }
      excludeBlockId = block.id;
    } else {
      const { data: block } = await db
        .from("crew_schedule_blocks")
        .select("id")
        .eq("reference_type", event_type)
        .eq("reference_id", event_id)
        .maybeSingle();
      excludeBlockId = block?.id;
    }

    const conflict = await checkCrewConflict(
      db,
      { crew_id, date, start, end },
      excludeBlockId
    );

    if (conflict.hasConflict) {
      const details = conflict.conflicts
        .map((c) => `${c.start}-${c.end} (${c.reference_label})`)
        .join(", ");
      return NextResponse.json(
        { error: `CONFLICT: Crew is booked ${details}` },
        { status: 409 }
      );
    }

    if (event_type === "blocked") {
      const { error } = await db
        .from("crew_schedule_blocks")
        .update({
          crew_id,
          block_date: date,
          block_start: start,
          block_end: end,
        })
        .eq("id", event_id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const table = event_type === "move" ? "moves" : "deliveries";
      const { data: existing } = await db
        .from(table)
        .select("status, calendar_status, crew_id, scheduled_start, scheduled_end")
        .eq("id", event_id)
        .single();

      if (existing) {
        const status = (existing.calendar_status || existing.status || "") as string;
        if (status === "completed") {
          const hasTime = !!(existing.scheduled_start || existing.scheduled_end);
          const hasTeam = !!existing.crew_id;
          if (hasTime || hasTeam) {
            return NextResponse.json(
              { error: "Completed jobs with time or team assigned cannot be edited." },
              { status: 403 }
            );
          }
        }
      }

      const { error: refError } = await db
        .from(table)
        .update({
          crew_id,
          scheduled_date: date,
          scheduled_start: start,
          scheduled_end: end,
          calendar_status: "scheduled",
        })
        .eq("id", event_id);

      if (refError) {
        return NextResponse.json({ error: refError.message }, { status: 500 });
      }

      const { data: existingBlock } = await db
        .from("crew_schedule_blocks")
        .select("id")
        .eq("reference_type", event_type)
        .eq("reference_id", event_id)
        .maybeSingle();

      if (existingBlock) {
        await db
          .from("crew_schedule_blocks")
          .update({
            crew_id,
            block_date: date,
            block_start: start,
            block_end: end,
          })
          .eq("id", existingBlock.id);
      } else {
        await createScheduleBlock(db, {
          crew_id,
          date,
          start,
          end,
          type: event_type,
          reference_id: event_id,
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to reschedule";
    const isConflict = message.startsWith("CONFLICT:");
    return NextResponse.json(
      { error: message },
      { status: isConflict ? 409 : 500 }
    );
  }
}

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
