import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDeliveryCalendarDescription } from "@/lib/calendar/delivery-event-label";
import type { TimeBlock, ConflictResult } from "./types";

const DAY_START = "06:00";
const DAY_END = "20:00";

export async function checkCrewConflict(
  supabase: SupabaseClient,
  block: TimeBlock,
  excludeBlockId?: string
): Promise<ConflictResult> {
  let query = supabase
    .from("crew_schedule_blocks")
    .select("*")
    .eq("crew_id", block.crew_id)
    .eq("block_date", block.date);

  if (excludeBlockId) {
    query = query.neq("id", excludeBlockId);
  }

  const { data: existingBlocks } = await query;

  const conflicts = (existingBlocks || []).filter((existing) => {
    return block.start < existing.block_end && block.end > existing.block_start;
  });

  const sortedBlocks = [...(existingBlocks || [])].sort((a, b) =>
    a.block_start.localeCompare(b.block_start)
  );

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

  const enrichedConflicts = await Promise.all(
    conflicts.map(async (c) => {
      let label = c.notes || "Blocked";
      if (c.reference_type === "move" && c.reference_id) {
        const { data: move } = await supabase
          .from("moves")
          .select("client_name, move_size")
          .eq("id", c.reference_id)
          .single();
        if (move) label = `${move.client_name || "Client"}, ${move.move_size || ""} Move`;
      } else if (c.reference_type === "delivery" && c.reference_id) {
        const { data: del } = await supabase
          .from("deliveries")
          .select("client_name, customer_name, delivery_type, category, item_count")
          .eq("id", c.reference_id)
          .single();
        if (del) {
          const name = del.client_name || del.customer_name || "Delivery";
          label = `${name}, ${formatDeliveryCalendarDescription(
            del.item_count,
            del.delivery_type || del.category,
          )}`;
        }
      }
      return {
        block_id: c.id,
        block_type: c.block_type,
        start: c.block_start,
        end: c.block_end,
        reference_type: c.reference_type || c.block_type,
        reference_label: label,
      };
    })
  );

  return {
    hasConflict: conflicts.length > 0,
    conflicts: enrichedConflicts,
    availableSlots,
  };
}

export async function createScheduleBlock(
  supabase: SupabaseClient,
  params: {
    crew_id: string;
    date: string;
    start: string;
    end: string;
    type: "move" | "delivery" | "project_phase" | "maintenance" | "training" | "break" | "blocked" | "time_off";
    reference_id?: string;
    notes?: string;
    created_by?: string;
  }
) {
  const conflict = await checkCrewConflict(supabase, {
    crew_id: params.crew_id,
    date: params.date,
    start: params.start,
    end: params.end,
  });

  if (conflict.hasConflict) {
    const details = conflict.conflicts
      .map((c) => `${c.start}-${c.end} (${c.reference_label})`)
      .join(", ");
    const slots = conflict.availableSlots
      .map((s) => `${s.start}-${s.end}`)
      .join(", ");
    throw new Error(
      `CONFLICT: Crew is booked ${details}. Available: ${slots || "none"}`
    );
  }

  const { data, error } = await supabase
    .from("crew_schedule_blocks")
    .insert({
      crew_id: params.crew_id,
      block_date: params.date,
      block_start: params.start,
      block_end: params.end,
      block_type: params.type,
      reference_id: params.reference_id || null,
      reference_type: params.type === "move" || params.type === "delivery" || params.type === "project_phase" ? params.type : null,
      notes: params.notes || null,
      created_by: params.created_by || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
