import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

export async function GET(req: NextRequest) {
  const { user, error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const supabase = await createClient();
  const url = new URL(req.url);

  const limitParam = url.searchParams.get("limit");
  const offsetParam = url.searchParams.get("offset");
  const sourceType = url.searchParams.get("source_type");
  const search = url.searchParams.get("q");
  const dateFrom = url.searchParams.get("from");
  const dateTo = url.searchParams.get("to");

  const limit = limitParam ? parseInt(limitParam, 10) : 50;
  const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

  let query = supabase
    .from("in_app_notifications")
    .select("*", { count: "exact" })
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (sourceType) {
    query = query.eq("source_type", sourceType);
  }
  if (search) {
    query = query.or(`title.ilike.%${search}%,body.ilike.%${search}%`);
  }
  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }
  if (dateTo) {
    query = query.lte("created_at", dateTo);
  }

  const { data: notifications, count } = await query;

  const { data: events } = await supabase
    .from("notification_events")
    .select("*")
    .order("display_order");

  const { data: preferences } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user!.id);

  return NextResponse.json({
    notifications: notifications ?? [],
    total: count ?? 0,
    events: events ?? [],
    preferences: preferences ?? [],
  });
}

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const body = await req.json();
  const { title, body: notifBody, icon, link, source_type, source_id, event_slug } = body;

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("in_app_notifications")
    .insert({
      user_id: user!.id,
      event_slug: event_slug || null,
      title,
      body: notifBody || null,
      icon: icon || "bell",
      link: link || null,
      source_type: source_type || null,
      source_id: source_id || null,
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ notification: data });
}

export async function PATCH(req: NextRequest) {
  const { user, error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const body = await req.json();
  const db = createAdminClient();

  if (body.all) {
    const { error } = await db
      .from("in_app_notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("user_id", user!.id)
      .eq("is_read", false);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    const isRead = body.read ?? body.is_read ?? true;
    const { error } = await db
      .from("in_app_notifications")
      .update({
        is_read: isRead,
        read_at: isRead ? new Date().toISOString() : null,
      })
      .eq("id", body.id)
      .eq("user_id", user!.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Provide id or all:true" }, { status: 400 });
}
