import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/check-role";

export async function GET() {
  const { user, error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const supabase = await createClient();

  // Get all events
  const { data: events } = await supabase
    .from("notification_events")
    .select("*")
    .order("display_order");

  // Get user's preferences
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("*")
    .eq("user_id", user!.id);

  return NextResponse.json({ events: events ?? [], preferences: prefs ?? [] });
}
