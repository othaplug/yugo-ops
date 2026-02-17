import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { getMoveCode } from "@/lib/move-code";
import { sendPushToUser } from "@/lib/web-push";

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

/** Send push notification to all staff (admin, manager, dispatcher; superadmin if in platform_users). */
async function notifyStaffClientMessage(
  moveCode: string,
  clientName: string,
  message: string
) {
  const admin = createAdminClient();
  const { data: platformUsers } = await admin
    .from("platform_users")
    .select("user_id")
    .in("role", ["admin", "manager", "dispatcher"]);
  const userIds = platformUsers?.map((r) => r.user_id) ?? [];
  const title = `Client message (${moveCode})`;
  const body = `${clientName || "Client"}: ${message.slice(0, 80)}${message.length > 80 ? "…" : ""}`;
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const url = baseUrl ? `${baseUrl}/admin/messages` : "/admin/messages";
  await Promise.allSettled(
    userIds.map((userId) => sendPushToUser(userId, { title, body, url }))
  );
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
    const clientName = move.client_name || "Client";

    await sendToSlack(moveId, clientName, message, moveCode);

    // Insert into messages table so it appears in admin Messages page thread
    await admin.from("messages").insert({
      thread_id: moveId,
      sender_name: clientName,
      sender_type: "client",
      content: message,
      is_read: false,
    });

    // Activity feed (command center) – use admin so unauthenticated track request can write
    try {
      await admin.from("status_events").insert({
        entity_type: "move",
        entity_id: moveId,
        event_type: "client_message",
        description: `Client message (${moveCode}): ${message.slice(0, 80)}${message.length > 80 ? "…" : ""}`,
        icon: "mail",
      });
    } catch {
      // status_events table may not exist in some envs
    }

    // Push to admin, manager, dispatcher (and superadmin if in platform_users)
    notifyStaffClientMessage(moveCode, clientName, message).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send message" },
      { status: 500 }
    );
  }
}
