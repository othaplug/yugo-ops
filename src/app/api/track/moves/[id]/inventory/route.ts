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
    const { data: items, error } = await admin
      .from("move_inventory")
      .select("id, room, item_name, status, box_number, sort_order")
      .eq("move_id", moveId)
      .order("room")
      .order("sort_order")
      .order("item_name");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ items: items ?? [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}
