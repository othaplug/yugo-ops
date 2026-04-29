import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { addCalendarDaysIso } from "@/lib/quotes/estate-schedule";

export const dynamic = "force-dynamic";

function calendarDaysBetween(anchorYmd: string, targetYmd: string): number {
  const a = new Date(`${anchorYmd.slice(0, 10)}T12:00:00`).getTime();
  const b = new Date(`${targetYmd.slice(0, 10)}T12:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86400000);
}

function normalizeTime(t: string | null | undefined): string | null {
  if (t == null || !String(t).trim()) return null;
  const s = String(t).trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  return `${m[1]!.padStart(2, "0")}:${m[2]}:00`;
}

/**
 * POST: Shift one move project day, or with shift_entire_project move every day by the same calendar offset.
 * sync_time_and_crew_to_all: when the calendar delta is 0 (same anchor date), copy start/end/crew to all days.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id: projectId } = await params;

  let body: {
    anchor_day_id?: string;
    target_date?: string;
    start_time?: string | null;
    end_time?: string | null;
    crew_id?: string | null;
    shift_entire_project?: boolean;
    sync_time_and_crew_to_all?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const anchorDayId = body.anchor_day_id?.trim();
  const targetDate = body.target_date?.trim();
  if (!anchorDayId || !targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    return NextResponse.json(
      { error: "anchor_day_id and target_date (YYYY-MM-DD) required" },
      { status: 400 },
    );
  }

  const shiftEntire = !!body.shift_entire_project;
  const syncAll = !!body.sync_time_and_crew_to_all;

  if (!shiftEntire && !syncAll) {
    return NextResponse.json(
      {
        error:
          "Set shift_entire_project and/or sync_time_and_crew_to_all, or use single-day PATCH",
      },
      { status: 400 },
    );
  }

  const db = createAdminClient();

  const { data: anchor, error: aErr } = await db
    .from("move_project_days")
    .select("id, project_id, date, phase_id, crew_ids")
    .eq("id", anchorDayId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (aErr || !anchor) {
    return NextResponse.json({ error: "Anchor day not found" }, { status: 404 });
  }

  const anchorYmd = String(anchor.date).slice(0, 10);
  const delta = calendarDaysBetween(anchorYmd, targetDate);

  const startNorm = normalizeTime(body.start_time ?? undefined);
  const endNorm = normalizeTime(body.end_time ?? undefined);
  const crewRaw = typeof body.crew_id === "string" ? body.crew_id.trim() : "";
  const crewIdsPayload =
    crewRaw !== "" ? [crewRaw] : ((anchor.crew_ids as string[] | null) ?? null);

  const { data: allDays, error: dErr } = await db
    .from("move_project_days")
    .select("id, date, phase_id")
    .eq("project_id", projectId)
    .order("day_number", { ascending: true });

  if (dErr || !allDays?.length) {
    return NextResponse.json({ error: "No project days found" }, { status: 404 });
  }

  const applyTimeCrew = (patch: Record<string, unknown>, force: boolean) => {
    if (!force) return;
    if (body.start_time !== undefined) patch.start_time = startNorm;
    if (body.end_time !== undefined) patch.end_time = endNorm;
    if (crewRaw !== "") patch.crew_ids = crewIdsPayload;
  };

  for (const row of allDays) {
    const oldD = String(row.date).slice(0, 10);
    let newD: string;
    if (shiftEntire) {
      newD = addCalendarDaysIso(oldD, delta);
      if (!newD) {
        return NextResponse.json({ error: "Invalid date computation" }, { status: 500 });
      }
    } else {
      newD = oldD;
    }

    const isAnchor = row.id === anchorDayId;
    const patch: Record<string, unknown> = { date: newD };

    if (syncAll || isAnchor) {
      applyTimeCrew(patch, true);
    }

    const { error: uErr } = await db.from("move_project_days").update(patch).eq("id", row.id);
    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }

    const phId = row.phase_id as string | null | undefined;
    if (phId) {
      const { error: phErr } = await db
        .from("move_project_phases")
        .update({ start_date: newD, end_date: newD })
        .eq("id", phId);
      if (phErr) {
        return NextResponse.json({ error: phErr.message }, { status: 500 });
      }
    }
  }

  const { data: refreshed } = await db
    .from("move_project_days")
    .select("date")
    .eq("project_id", projectId)
    .order("day_number", { ascending: true });

  const dates = (refreshed || [])
    .map((r) => String(r.date).slice(0, 10))
    .filter(Boolean)
    .sort();
  if (dates.length > 0) {
    const { error: pErr } = await db
      .from("move_projects")
      .update({
        start_date: dates[0]!,
        end_date: dates[dates.length - 1]!,
        updated_at: new Date().toISOString(),
      })
      .eq("id", projectId);
    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
