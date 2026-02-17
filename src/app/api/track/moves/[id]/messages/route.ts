import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

/** Client fetches messages for their move (thread_id = moveId) using track token */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: moveId } = await params;
    const token = req.nextUrl.searchParams.get("token") || "";
    if (!verifyTrackToken("move", moveId, token)) {
      return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("messages")
      .select("id, sender_name, sender_type, content, created_at")
      .eq("thread_id", moveId)
      .order("created_at", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ messages: data ?? [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
