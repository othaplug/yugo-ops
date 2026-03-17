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
    .select("type, name")
    .eq("id", primaryOrgId!)
    .single();

  const orgType = org?.type || "retail";

  // Resolve org names for client_name fallback matching
  const orgNamesRes = await admin
    .from("organizations")
    .select("name")
    .in("id", orgIds);
  const orgNames = (orgNamesRes.data || []).map((o) => o.name).filter(Boolean);

  const [
    byOrgIdRes,
    byClientNameRes,
    recentMovesRes,
    invoicesRes,
    referralsRes,
    galleryProjectsRes,
  ] = await Promise.all([
    admin
      .from("deliveries")
      .select("*")
      .in("organization_id", orgIds)
      .order("scheduled_date", { ascending: true })
      .order("created_at", { ascending: false }),
    // Fallback: deliveries with matching client_name but NULL organization_id
    orgNames.length > 0
      ? admin
          .from("deliveries")
          .select("*")
          .is("organization_id", null)
          .in("client_name", orgNames)
          .order("scheduled_date", { ascending: true })
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[], error: null }),
    admin
      .from("moves")
      .select("id, move_code, client_name, status, stage, scheduled_date, scheduled_time, from_address, to_address, crew_id")
      .in("organization_id", orgIds)
      .order("scheduled_date", { ascending: false })
      .limit(20),
    admin
      .from("invoices")
      .select("id, invoice_number, client_name, amount, status, due_date, created_at, delivery_id, square_invoice_url, square_receipt_url")
      .in("organization_id", orgIds)
      .order("created_at", { ascending: false }),
    orgType === "realtor"
      ? admin.from("referrals").select("*").in("organization_id", orgIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[], error: null }),
    (orgType === "designer" || orgType === "gallery")
      ? admin.from("gallery_projects").select("*").in("gallery_org_id", orgIds).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[], error: null }),
  ]);

  // Surface any query errors so they're not silently swallowed
  if (byOrgIdRes.error) console.error("[portal-data] deliveries byOrgId query failed:", byOrgIdRes.error.message, { orgIds });
  if (byClientNameRes.error) console.error("[portal-data] deliveries byClientName query failed:", byClientNameRes.error.message);
  if (recentMovesRes.error) console.error("[portal-data] moves query failed:", recentMovesRes.error.message);
  if (invoicesRes.error) console.error("[portal-data] invoices query failed:", invoicesRes.error.message);

  const byOrgId = byOrgIdRes.data;
  const byClientName = byClientNameRes.data;
  const recentMoves = recentMovesRes.data;
  const invoices = invoicesRes.data;
  const referrals = referralsRes.data;
  const galleryProjects = galleryProjectsRes.data;

  console.log("[portal-data] orgIds:", orgIds, "byOrgId count:", byOrgId?.length ?? "null", "byClientName count:", byClientName?.length ?? "null");

  // Merge org_id matched + client_name fallback, dedup by id
  const seenIds = new Set<string>();
  const allDeliveries: typeof byOrgId = [];
  for (const d of [...(byOrgId || []), ...(byClientName || [])]) {
    if (!seenIds.has(d.id)) {
      seenIds.add(d.id);
      allDeliveries.push(d);
    }
  }

  // Backfill: async update orphaned deliveries so future queries use organization_id directly
  const orphanIds = (byClientName || []).map((d) => d.id);
  if (orphanIds.length > 0) {
    admin
      .from("deliveries")
      .update({ organization_id: primaryOrgId })
      .in("id", orphanIds)
      .is("organization_id", null)
      .then(() => {});
  }

  const dels = allDeliveries;
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

  // Satisfaction score from proof_of_delivery
  const deliveryIds = dels.map((d) => d.id);
  let satisfactionScore: number | null = null;
  if (deliveryIds.length > 0) {
    const { data: pods } = await admin
      .from("proof_of_delivery")
      .select("satisfaction_rating")
      .in("delivery_id", deliveryIds)
      .not("satisfaction_rating", "is", null);
    if (pods && pods.length > 0) {
      let sum = 0, count = 0;
      for (const p of pods) {
        const r = p.satisfaction_rating;
        if (r >= 1 && r <= 5) { sum += r; count++; }
      }
      if (count > 0) satisfactionScore = Math.round((sum / count) * 10) / 10;
    }
  }

  return NextResponse.json({
    orgType,
    deliveriesCount: dels.length,
    movesCount: (recentMoves || []).length,
    completedThisMonth,
    onTimeRate,
    satisfactionScore,
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
