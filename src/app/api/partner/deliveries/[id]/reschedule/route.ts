import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { newDate, newWindow } = await req.json();

  if (!newDate || !newWindow) {
    return NextResponse.json({ error: "newDate and newWindow are required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify the delivery belongs to the partner's org
  const { data: partnerUser } = await supabase
    .from("partner_users")
    .select("org_id")
    .eq("user_id", user.id)
    .single();
  if (!partnerUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: delivery } = await admin
    .from("deliveries")
    .select("id, delivery_number, scheduled_date, time_slot, partner_id, status")
    .eq("id", id)
    .eq("partner_id", partnerUser.org_id)
    .single();

  if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });

  // Check 24-hour notice
  const scheduledAt = delivery.scheduled_date
    ? new Date(delivery.scheduled_date + "T12:00:00")
    : null;
  const hoursUntil = scheduledAt
    ? (scheduledAt.getTime() - Date.now()) / 3600000
    : 0;

  if (hoursUntil < 24) {
    return NextResponse.json({
      error: "Reschedule requires at least 24-hour notice. Contact your coordinator.",
    }, { status: 400 });
  }

  // Check availability: count deliveries already scheduled for that date/window
  const { count } = await admin
    .from("deliveries")
    .select("id", { count: "exact", head: true })
    .eq("scheduled_date", newDate)
    .eq("time_slot", newWindow)
    .neq("status", "cancelled")
    .neq("id", id);

  const maxDeliveriesPerSlot = 8;
  if ((count ?? 0) >= maxDeliveriesPerSlot) {
    // Find alternatives
    const alternatives = await getAlternatives(admin, newDate, newWindow);
    return NextResponse.json({
      error: "This slot is not available.",
      alternatives,
    }, { status: 409 });
  }

  // Apply reschedule
  await admin
    .from("deliveries")
    .update({
      scheduled_date: newDate,
      time_slot: newWindow,
      rescheduled_by: "partner",
      rescheduled_at: new Date().toISOString(),
    })
    .eq("id", id);

  // Notify coordinator via status event
  await admin.from("status_events").insert({
    entity_type: "delivery",
    entity_id: id,
    event_type: "rescheduled_by_partner",
    description: `Partner rescheduled DLV-${delivery.delivery_number} to ${newDate} (${newWindow})`,
    icon: "Calendar",
  }).then(() => {});

  return NextResponse.json({ success: true, newDate, newWindow });
}

async function getAlternatives(
  admin: ReturnType<typeof createAdminClient>,
  date: string,
  excludeWindow: string
) {
  const windows = ["morning", "afternoon", "evening", "flexible"];
  const altDate1 = new Date(date);
  altDate1.setDate(altDate1.getDate() + 1);
  const altDate2 = new Date(date);
  altDate2.setDate(altDate2.getDate() + 2);

  const candidates = [
    ...windows.filter((w) => w !== excludeWindow).map((w) => ({ date, window: w })),
    ...windows.slice(0, 2).map((w) => ({ date: altDate1.toISOString().slice(0, 10), window: w })),
    ...windows.slice(0, 2).map((w) => ({ date: altDate2.toISOString().slice(0, 10), window: w })),
  ];

  const available: { date: string; window: string }[] = [];
  for (const candidate of candidates.slice(0, 6)) {
    const { count } = await admin
      .from("deliveries")
      .select("id", { count: "exact", head: true })
      .eq("scheduled_date", candidate.date)
      .eq("time_slot", candidate.window)
      .neq("status", "cancelled");
    if ((count ?? 0) < 8) {
      available.push(candidate);
      if (available.length >= 3) break;
    }
  }

  return available;
}
