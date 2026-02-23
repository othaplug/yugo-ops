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
    const [invRes, extraRes] = await Promise.all([
      admin.from("move_inventory").select("id, room, item_name, box_number, sort_order").eq("move_id", moveId).order("room").order("sort_order").order("item_name"),
      admin.from("extra_items").select("id, description, room, quantity, added_at").eq("job_id", moveId).eq("status", "approved").order("added_at"),
    ]);
    const { data: items, error } = invRes;
    const { data: extraItems } = extraRes;

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ items: items ?? [], extraItems: extraItems ?? [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}
