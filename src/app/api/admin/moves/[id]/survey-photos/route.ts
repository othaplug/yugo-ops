import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/**
 * GET /api/admin/moves/[id]/survey-photos
 *
 * Returns the client's pre-move room photos (from the "Help us prepare"
 * survey email). Source: move_survey_photos table, written by
 * /api/survey/[token]. Photos are stored in the `move-assets` bucket under
 * survey/{move_id}/... and have public URLs (no signing needed).
 *
 * Surfaced inside MoveFilesSection so coordinators see all photo sources
 * (client pre-move + admin uploads + crew checkpoint photos) in one place.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
    const admin = createAdminClient();
    const { data: rows, error } = await admin
      .from("move_survey_photos")
      .select("id, room, photo_url, notes, uploaded_at")
      .eq("move_id", moveId)
      .order("uploaded_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const photos = (rows ?? []).map((p) => ({
      id: p.id as string,
      url: (p.photo_url as string | null) ?? "",
      room: (p.room as string | null) ?? "other",
      caption:
        ((p.notes as string | null)?.trim() || null) ??
        toRoomLabel((p.room as string | null) ?? "other"),
      date: (p.uploaded_at as string | null) ?? new Date().toISOString(),
    }));

    return NextResponse.json({ photos });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to fetch survey photos",
      },
      { status: 500 },
    );
  }
}

function toRoomLabel(room: string): string {
  const cleaned = (room || "other").replace(/_/g, " ").trim();
  if (!cleaned) return "Other";
  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}
