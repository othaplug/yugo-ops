import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

export interface PartnerHealthRow {
  id: string;
  name: string;
  type: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  last_delivery_at: string | null;
  health_status: "active" | "at_risk" | "cold" | "churned";
  volume_30d: number;
  revenue_30d: number;
  trend: "increasing" | "stable" | "declining";
  avg_rating: number | null;
  days_since_last: number | null;
}

function getHealthStatus(lastDeliveryAt: string | null): PartnerHealthRow["health_status"] {
  if (!lastDeliveryAt) return "churned";
  const days = Math.floor((Date.now() - new Date(lastDeliveryAt).getTime()) / 86_400_000);
  if (days <= 14) return "active";
  if (days <= 30) return "at_risk";
  if (days <= 60) return "cold";
  return "churned";
}

function getTrend(current: number, previous: number): PartnerHealthRow["trend"] {
  if (previous === 0 && current === 0) return "stable";
  if (previous === 0) return current > 0 ? "increasing" : "stable";
  const ratio = current / previous;
  if (ratio > 1.15) return "increasing";
  if (ratio < 0.85) return "declining";
  return "stable";
}

/** Revenue figure from delivery row (schema uses total_price / admin_adjusted_price / base_price). */
function deliveryRevenue(d: {
  total_price?: number | null;
  admin_adjusted_price?: number | null;
  base_price?: number | null;
}): number {
  const tp = d.total_price != null ? Number(d.total_price) : null;
  const ap = d.admin_adjusted_price != null ? Number(d.admin_adjusted_price) : null;
  const bp = d.base_price != null ? Number(d.base_price) : null;
  return ap ?? tp ?? bp ?? 0;
}

const COMPLETED_STATUSES = ["completed", "delivered"];

export async function GET() {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const admin = createAdminClient();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86_400_000).toISOString();

  // Same partner scope as /api/admin/partners/list (exclude consumer orgs only).
  // Try with new columns first; fall back to the stable baseline if migration not yet applied.
  let { data: orgs, error: orgsError } = await admin
    .from("organizations")
    .select("id, name, type, vertical, contact_name, email, phone, last_delivery_at")
    .not("type", "eq", "b2c")
    .order("name");

  // last_delivery_at may not exist yet if the migration hasn't been applied — retry without it
  if (orgsError && /last_delivery_at|column|does not exist/i.test(orgsError.message)) {
    const retry = await admin
      .from("organizations")
      .select("id, name, type, vertical, contact_name, email, phone")
      .not("type", "eq", "b2c")
      .order("name");
    orgs = retry.data as typeof orgs;
    orgsError = retry.error;
  }

  if (orgsError) {
    return NextResponse.json({ error: orgsError.message }, { status: 500 });
  }

  const orgIds = (orgs ?? []).map((o) => o.id);

  if (orgIds.length === 0) {
    return NextResponse.json({ partners: [], stats: { total: 0, active: 0, at_risk: 0, cold: 0, churned: 0 } });
  }

  // Latest completed_at per org (covers orgs before last_delivery_at column / backfill)
  const lastCompletedByOrg: Record<string, string> = {};
  const ORG_CHUNK = 50;
  for (let i = 0; i < orgIds.length; i += ORG_CHUNK) {
    const chunk = orgIds.slice(i, i + ORG_CHUNK);
    const { data: rows } = await admin
      .from("deliveries")
      .select("organization_id, completed_at")
      .in("organization_id", chunk)
      .in("status", COMPLETED_STATUSES)
      .not("completed_at", "is", null);
    for (const row of rows ?? []) {
      const oid = row.organization_id as string | null;
      const ts = row.completed_at as string | null;
      if (!oid || !ts) continue;
      const prev = lastCompletedByOrg[oid];
      if (!prev || ts > prev) lastCompletedByOrg[oid] = ts;
    }
  }

  // Deliveries in last 30 days (current period)
  const { data: deliveries30 } = await admin
    .from("deliveries")
    .select("organization_id, base_price, total_price, admin_adjusted_price, status, completed_at")
    .in("organization_id", orgIds)
    .gte("completed_at", thirtyDaysAgo)
    .in("status", COMPLETED_STATUSES);

  // Previous 30 days (for trend)
  const { data: deliveriesPrev } = await admin
    .from("deliveries")
    .select("organization_id, status, completed_at")
    .in("organization_id", orgIds)
    .gte("completed_at", sixtyDaysAgo)
    .lt("completed_at", thirtyDaysAgo)
    .in("status", COMPLETED_STATUSES);

  type Delivery30 = {
    organization_id: string;
    base_price?: number | null;
    total_price?: number | null;
    admin_adjusted_price?: number | null;
  };
  type DeliveryPrev = { organization_id: string };

  const volumeMap: Record<string, number> = {};
  const revenueMap: Record<string, number> = {};
  for (const d of (deliveries30 ?? []) as Delivery30[]) {
    const oid = d.organization_id;
    if (!oid) continue;
    volumeMap[oid] = (volumeMap[oid] || 0) + 1;
    revenueMap[oid] = (revenueMap[oid] || 0) + deliveryRevenue(d);
  }

  const prevVolumeMap: Record<string, number> = {};
  for (const d of (deliveriesPrev ?? []) as DeliveryPrev[]) {
    const oid = d.organization_id;
    if (!oid) continue;
    prevVolumeMap[oid] = (prevVolumeMap[oid] || 0) + 1;
  }

  const partners: PartnerHealthRow[] = (orgs ?? []).map((org) => {
    const vol = volumeMap[org.id] || 0;
    const prevVol = prevVolumeMap[org.id] || 0;
    const rev = revenueMap[org.id] || 0;

    const rowLast = org.last_delivery_at as string | null | undefined;
    const lastAt = rowLast ?? lastCompletedByOrg[org.id] ?? null;
    const daysSince = lastAt
      ? Math.floor((now.getTime() - new Date(lastAt).getTime()) / 86_400_000)
      : null;

    const displayType =
      (org as { vertical?: string | null }).vertical ||
      (org.type as string) ||
      "";

    return {
      id: org.id,
      name: org.name,
      type: displayType,
      contact_name: org.contact_name,
      email: org.email,
      phone: org.phone,
      last_delivery_at: lastAt,
      health_status: getHealthStatus(lastAt),
      volume_30d: vol,
      revenue_30d: Math.round(rev),
      trend: getTrend(vol, prevVol),
      avg_rating: null,
      days_since_last: daysSince,
    };
  });

  const urgencyOrder: Record<string, number> = { at_risk: 0, cold: 1, churned: 2, active: 3 };
  partners.sort((a, b) => (urgencyOrder[a.health_status] ?? 4) - (urgencyOrder[b.health_status] ?? 4));

  const stats = {
    total: partners.length,
    active: partners.filter((p) => p.health_status === "active").length,
    at_risk: partners.filter((p) => p.health_status === "at_risk").length,
    cold: partners.filter((p) => p.health_status === "cold").length,
    churned: partners.filter((p) => p.health_status === "churned").length,
  };

  return NextResponse.json({ partners, stats });
}
