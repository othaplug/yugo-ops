import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { getMoveCode } from "@/lib/move-code";

async function sendToSlack(moveId: string, clientName: string, message: string, moveCode: string) {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_ADMIN_CHANNEL || process.env.SLACK_CHANNEL_ID;
  if (!token || !channel) return;

  const text = `*Client message* (${moveCode})\n_${clientName || "Client"}_: ${message}`;

  try {
    await fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ channel, text }),
    });
  } catch {
    // Slack optional
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: moveId } = await params;
    const token = req.nextUrl.searchParams.get("token") || "";
    if (!verifyTrackToken("move", moveId, token)) {
      return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
    }

    const body = await req.json();
    const message = (body.message || "").trim();
    if (!message || message.length > 2000) {
      return NextResponse.json({ error: "Message is required (max 2000 chars)" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: move, error: fetchErr } = await admin
      .from("moves")
      .select("internal_notes, client_name")
      .eq("id", moveId)
      .single();

    if (fetchErr || !move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

    const timestamp = new Date().toISOString().slice(0, 19).replace("T", " ");
    const clientNote = `[${timestamp}] (Client message)\n${message}`;
    const updatedNotes = move.internal_notes
      ? `${move.internal_notes}\n\n---\n\n${clientNote}`
      : clientNote;

    const { error: updateErr } = await admin
      .from("moves")
      .update({ internal_notes: updatedNotes, updated_at: new Date().toISOString() })
      .eq("id", moveId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    const moveCode = getMoveCode({ id: moveId });
    await sendToSlack(moveId, move.client_name || "", message, moveCode);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send message" },
      { status: 500 }
    );
  }
}
