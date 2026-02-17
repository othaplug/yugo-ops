import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  try {
    const { id: moveId } = await params;
    const admin = createAdminClient();

    // Mark client messages as read when admin views
    await admin
      .from("messages")
      .update({ is_read: true })
      .eq("thread_id", moveId)
      .eq("sender_type", "client");

    const { data, error } = await admin
      .from("messages")
      .select("id, sender_name, sender_type, content, is_read, created_at")
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;
  try {
    const { id: moveId } = await params;
    const body = await req.json();
    const content = (body.content || body.message || "").trim();
    if (!content || content.length > 2000) {
      return NextResponse.json(
        { error: "Message is required (max 2000 chars)" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const senderName = body.senderName || "Yugo";

    const { data: inserted, error } = await admin
      .from("messages")
      .insert({
        thread_id: moveId,
        sender_name: senderName,
        sender_type: "admin",
        content,
        is_read: true,
      })
      .select("id, sender_name, sender_type, content, is_read, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ message: inserted });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send message" },
      { status: 500 }
    );
  }
}
