import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { getTodayString, getMonthStartString } from "@/lib/business-timezone";

export async function GET() {
  const { orgIds, primaryOrgId, error } = await requirePartner();
  if (error) return error;
  if (!orgIds.length) {
    return NextResponse.json({ error: "No organization linked" }, { status: 403 });
  }

  const admin = createAdminClient();
  const todayStr = getTodayString();
  const thisMonthStart = getMonthStartString();

  const { data: org } = await admin
    .from("organizations")
    .select("type")
    .eq("id", primaryOrgId!)
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
      .select("id, delivery_number, customer_name, client_name, status, stage, scheduled_date, time_slot, delivery_address, pickup_address, items, category, crew_id, created_at, quoted_price, total_price, admin_adjusted_price")
      .in("organization_id", orgIds)
      .order("scheduled_date", { ascending: true })
      .order("created_at", { ascending: false }),
    admin
      .from("moves")
      .select("id, move_code, client_name, status, stage, scheduled_date, scheduled_time, from_address, to_address, crew_id")
      .in("organization_id", orgIds)
      .order("scheduled_date", { ascending: false })
      .limit(20),
    admin
      .from("invoices")
      .select("id, invoice_number, client_name, amount, status, due_date, created_at")
      .in("organization_id", orgIds)
      .order("created_at", { ascending: false }),
    orgType === "realtor"
      ? admin.from("referrals").select("*").in("organization_id", orgIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    (orgType === "designer" || orgType === "gallery")
      ? admin.from("gallery_projects").select("*").in("gallery_org_id", orgIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  console.log("DEBUG portal-data", {
    orgIds,
    primaryOrgId,
    deliveriesCount: allDeliveries?.length,
    deliveriesError: allDeliveries === null ? "null result" : "ok",
    firstDelivery: allDeliveries?.[0] || null,
  });

  const dels = allDeliveries || [];
  const invs = invoices || [];
  const refs = referrals || [];

  const DONE_STATUSES = new Set(["cancelled", "rejected", "delivered", "completed"]);

  /** Normalize status for comparison (handles "Pending Approval", "pending_approval", etc.) */
  const normStatus = (status: string | null | undefined) =>
    (status || "").toLowerCase().replace(/\s+/g, "_");

  /** Normalize to YYYY-MM-DD for comparison (handles ISO timestamps and date-only strings) */
  const dateOnly = (d: string | null | undefined) =>
    d ? String(d).slice(0, 10) : null;

  // Approved/confirmed statuses: show in Today when date is today, always in Upcoming
  const APPROVED_STATUSES = new Set(["confirmed", "accepted", "scheduled", "approved"]);

  // Today: not done, and scheduled date is today (normalized)
  const todayDeliveries = dels.filter((d) => {
    const s = normStatus(d.status);
    if (DONE_STATUSES.has(s)) return false;
    const dStr = dateOnly(d.scheduled_date);
    return dStr === todayStr;
  });

  // Upcoming: pending_approval and pending always; approved/confirmed/accepted/scheduled always; others only if future date
  const upcomingDeliveries = dels.filter((d) => {
    const s = normStatus(d.status);
    if (DONE_STATUSES.has(s)) return false;
    if (s === "pending_approval" || s === "pending") return true;
    if (APPROVED_STATUSES.has(s)) return true; // approved/confirmed/accepted/scheduled always show in Upcoming
    const dStr = dateOnly(d.scheduled_date);
    if (!dStr) return false;
    return dStr > todayStr;
  });

  const completedThisMonth = dels.filter((d) => {
    const s = normStatus(d.status);
    return (s === "delivered" || s === "completed") && d.scheduled_date && d.scheduled_date >= thisMonthStart;
  }).length;

  const totalDelivered = dels.filter((d) => {
    const s = normStatus(d.status);
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
