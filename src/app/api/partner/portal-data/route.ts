import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { getTodayString, getMonthStartString } from "@/lib/business-timezone";

export async function GET() {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  const admin = createAdminClient();
  const todayStr = getTodayString();
  const thisMonthStart = getMonthStartString();

  const { data: org } = await admin
    .from("organizations")
    .select("type")
    .eq("id", orgId!)
    .single();

  const orgType = org?.type || "retail";

  const [
    { data: allDeliveries },
    { data: recentMoves },
    { data: invoices },
    { data: referrals },
    { data: galleryProjects },
  ] = await Promise.all([
    admin
      .from("deliveries")
      .select("id, delivery_number, customer_name, client_name, status, stage, scheduled_date, time_slot, delivery_address, pickup_address, items, category, crew_id, created_at")
      .eq("organization_id", orgId!)
      .order("scheduled_date", { ascending: true })
      .order("created_at", { ascending: false }),
    admin
      .from("moves")
      .select("id, move_code, client_name, status, stage, scheduled_date, scheduled_time, from_address, to_address, crew_id")
      .eq("organization_id", orgId!)
      .order("scheduled_date", { ascending: false })
      .limit(20),
    admin
      .from("invoices")
      .select("id, invoice_number, client_name, amount, status, due_date, created_at")
      .eq("organization_id", orgId!)
      .order("created_at", { ascending: false }),
    orgType === "realtor"
      ? admin.from("referrals").select("*").order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    (orgType === "designer" || orgType === "gallery")
      ? admin.from("gallery_projects").select("*").eq("gallery_org_id", orgId!).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const dels = allDeliveries || [];
  const invs = invoices || [];
  const refs = referrals || [];

  const todayDeliveries = dels.filter((d) => d.scheduled_date?.slice(0, 10) === todayStr);
  const upcomingDeliveries = dels.filter((d) => {
    if (!d.scheduled_date) return false;
    return d.scheduled_date.slice(0, 10) > todayStr;
  });

  const completedThisMonth = dels.filter((d) => {
    const s = (d.status || "").toLowerCase();
    return (s === "delivered" || s === "completed") && d.scheduled_date && d.scheduled_date >= thisMonthStart;
  }).length;

  const totalDelivered = dels.filter((d) => {
    const s = (d.status || "").toLowerCase();
    return s === "delivered" || s === "completed";
  }).length;
  const onTimeRate = dels.length > 0 ? Math.round((totalDelivered / dels.length) * 100) : 100;

  const outstandingInvs = invs.filter((i) => i.status === "sent" || i.status === "overdue");
  const outstandingAmount = outstandingInvs.reduce((s, i) => s + Number(i.amount || 0), 0);
  const outstandingDueDate = outstandingInvs.length > 0
    ? outstandingInvs.sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""))[0]?.due_date || null
    : null;

  const completedRefs = refs.filter((r) => r.status === "completed" || r.status === "booked");
  const totalEarned = completedRefs.reduce((s, r) => s + Number(r.commission || 0), 0);

  return NextResponse.json({
    orgType,
    deliveriesCount: dels.length,
    movesCount: (recentMoves || []).length,
    completedThisMonth,
    onTimeRate,
    damageClaims: 0,
    outstandingAmount,
    outstandingDueDate,
    todayDeliveries,
    upcomingDeliveries,
    allDeliveries: dels,
    recentMoves: recentMoves || [],
    invoices: invs,
    referrals: refs,
    totalEarned,
    completedReferrals: completedRefs.length,
    projects: galleryProjects || [],
  });
}
