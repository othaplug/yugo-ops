import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;

  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];
  const supabase = createAdminClient();

  const [movesRes, deliveriesRes] = await Promise.all([
    supabase
      .from("moves")
      .select("id, move_code, client_name, from_address, to_address, scheduled_date, scheduled_time, status, move_type, crew_id")
      .eq("crew_id", payload.teamId)
      .gte("scheduled_date", today)
      .lte("scheduled_date", today)
      .order("scheduled_date")
      .order("scheduled_time"),
    supabase
      .from("deliveries")
      .select("id, delivery_number, customer_name, client_name, pickup_address, delivery_address, scheduled_date, time_slot, status, items, crew_id")
      .eq("crew_id", payload.teamId)
      .gte("scheduled_date", today)
      .lte("scheduled_date", today)
      .order("scheduled_date")
      .order("time_slot"),
  ]);

  const moves = movesRes.data || [];
  const deliveries = deliveriesRes.data || [];

  type Job = {
    id: string;
    jobId: string;
    jobType: "move" | "delivery";
    clientName: string;
    fromAddress: string;
    toAddress: string;
    jobTypeLabel: string;
    itemCount?: number;
    scheduledTime: string;
    status: string;
    completedAt?: string | null;
  };

  const jobs: Job[] = [];

  for (const m of moves) {
    const time = m.scheduled_time || "9:00 AM";
    jobs.push({
      id: m.id,
      jobId: m.move_code || m.id,
      jobType: "move",
      clientName: m.client_name || "—",
      fromAddress: m.from_address || "—",
      toAddress: m.to_address || "—",
      jobTypeLabel: m.move_type === "office" ? "Office · Commercial" : "Premier Residential",
      scheduledTime: time,
      status: m.status || "scheduled",
      completedAt: null,
    });
  }

  for (const d of deliveries) {
    const items = Array.isArray(d.items) ? d.items : [];
    const time = d.time_slot || "2:00 PM";
    jobs.push({
      id: d.id,
      jobId: d.delivery_number || d.id,
      jobType: "delivery",
      clientName: `${d.customer_name || "—"}${d.client_name ? ` (${d.client_name})` : ""}`,
      fromAddress: d.pickup_address || "Warehouse",
      toAddress: d.delivery_address || "—",
      jobTypeLabel: `Delivery · ${items.length} items`,
      itemCount: items.length,
      scheduledTime: time,
      status: d.status || "scheduled",
      completedAt: null,
    });
  }

  jobs.sort((a, b) => {
    const tA = parseTime(a.scheduledTime);
    const tB = parseTime(b.scheduledTime);
    return tA - tB;
  });

  const [{ data: readinessCheck }, { data: crewRow }] = await Promise.all([
    supabase.from("readiness_checks").select("id").eq("team_id", payload.teamId).eq("check_date", today).maybeSingle(),
    supabase.from("crews").select("name").eq("id", payload.teamId).single(),
  ]);

  const readinessCompleted = !!readinessCheck?.id;
  const isCrewLead = payload.role === "lead";
  const readinessRequired = !readinessCompleted && (isCrewLead || jobs.length > 0);
  const teamName = crewRow?.name || "Team";

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const d = new Date();
  const dateStr = `${dayNames[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;

  return NextResponse.json({
    crewMember: { ...payload, teamName, dateStr },
    jobs,
    readinessCompleted,
    readinessRequired,
    isCrewLead,
  });
}

function parseTime(s: string): number {
  const m = s.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!m) return 0;
  let h = parseInt(m[1], 10) || 0;
  const min = parseInt(m[2], 10) || 0;
  const ampm = (m[3] || "").toLowerCase();
  if (ampm === "pm" && h < 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h * 60 + min;
}
