import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

export async function PUT(req: NextRequest) {
  const { user, error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const body = await req.json();
  const { event_slug, email_enabled, sms_enabled, push_enabled } = body;

  if (!event_slug) {
    return NextResponse.json({ error: "event_slug required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_preferences")
    .upsert(
      {
        user_id: user!.id,
        event_slug,
        email_enabled: email_enabled ?? true,
        sms_enabled: sms_enabled ?? false,
        push_enabled: push_enabled ?? true,
      },
      { onConflict: "user_id,event_slug" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST: Bulk update all preferences for a channel (master toggle)
export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const body = await req.json();
  const { channel, enabled } = body; // channel: "email" | "sms" | "push"

  if (!channel || typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "channel and enabled required" },
      { status: 400 }
    );
  }

  const columnMap: Record<string, string> = {
    email: "email_enabled",
    sms: "sms_enabled",
    push: "push_enabled",
  };
  const column = columnMap[channel];
  if (!column) {
    return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Get all event slugs
  const { data: events } = await admin
    .from("notification_events")
    .select("event_slug");

  if (!events?.length) {
    return NextResponse.json({ ok: true });
  }

  // Upsert preferences for all events
  const rows = events.map((e: { event_slug: string }) => ({
    user_id: user!.id,
    event_slug: e.event_slug,
    [column]: enabled,
  }));

  const { error } = await admin
    .from("notification_preferences")
    .upsert(rows, { onConflict: "user_id,event_slug" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
