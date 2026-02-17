import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: photos, error } = await admin
      .from("move_photos")
      .select("id, storage_path, caption, sort_order")
      .eq("move_id", moveId)
      .order("sort_order")
      .order("created_at");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const bucket = "move-photos";
    const urls: { id: string; url: string; caption: string | null }[] = [];
    for (const p of photos ?? []) {
      const { data: signed } = await admin.storage.from(bucket).createSignedUrl(p.storage_path, 3600);
      urls.push({ id: p.id, url: signed?.signedUrl ?? "", caption: p.caption });
    }
    return NextResponse.json({ photos: urls });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
