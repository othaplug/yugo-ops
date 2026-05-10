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
  /** B2B delivery_verticals revenue mix, last 90 days (completed / delivered). */
  revenue_by_vertical_90d: { code: string; label: string; revenue: number; pct: number }[];
}

/**
 * Classify health from last-activity date.
 * If there is no activity, fall back to how long the org has been a partner:
 *   - joined < 30 days ago → active (brand new, give them time)
 *   - joined 30–60 days ago → at_risk (needs engagement)
 *   - joined > 60 days ago → churned (inactive long enough to count)
 */
function getHealthStatus(
  lastActivityAt: string | null,
  orgCreatedAt: string | null,
): PartnerHealthRow["health_status"] {
  if (lastActivityAt) {
    const days = Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / 86_400_000);
    if (days <= 14) return "active";
    if (days <= 30) return "at_risk";
    if (days <= 60) return "cold";
    return "churned";
  }
  // No recorded activity — use partner tenure
  if (orgCreatedAt) {
    const daysSince = Math.floor(
      (Date.now() - new Date(orgCreatedAt).getTime()) / 86_400_000,
    );
    if (daysSince <= 30) return "active";
    if (daysSince <= 60) return "at_risk";
  }
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

/** Revenue figure from delivery row. */
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
const PM_MOVE_STATUSES = ["completed", "booked", "confirmed", "in_progress", "scheduled"];

/** True for property-management org types. */
function isPmType(type: string | null | undefined): boolean {
  return String(type || "").toLowerCase().includes("property_management");
}

export async function GET() {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const admin = createAdminClient();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86_400_000).toISOString();

  // Fetch orgs — include created_at for new-partner classification
  let { data: orgs, error: orgsError } = await admin
    .from("organizations")
    .select("id, name, type, vertical, contact_name, email, phone, last_delivery_at, created_at")
    .not("type", "eq", "b2c")
    .order("name");

  if (orgsError && /last_delivery_at|column|does not exist/i.test(orgsError.message)) {
    const retry = await admin
      .from("organizations")
      .select("id, name, type, vertical, contact_name, email, phone, created_at")
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

  // ── Split PM vs delivery org IDs ──────────────────────────────────────────
  const pmOrgIds = (orgs ?? []).filter((o) => isPmType(o.type)).map((o) => o.id);
  const deliveryOrgIds = orgIds.filter((id) => !pmOrgIds.includes(id));

  // ── Moves data for PM orgs ────────────────────────────────────────────────
  const movesLastActivity: Record<string, string> = {};
  const movesVolume30d: Record<string, number> = {};
  const movesRevenue30d: Record<string, number> = {};
  const movesPrevVolume: Record<string, number> = {};

  if (pmOrgIds.length > 0) {
    const ORG_CHUNK = 50;

    // Last activity: pick the most-recent scheduled_date or completed_at
    for (let i = 0; i < pmOrgIds.length; i += ORG_CHUNK) {
      const chunk = pmOrgIds.slice(i, i + ORG_CHUNK);
      const { data: rows } = await admin
        .from("moves")
        .select("organization_id, completed_at, scheduled_date")
        .in("organization_id", chunk)
        .in("status", PM_MOVE_STATUSES)
        .not("organization_id", "is", null);

      for (const m of rows ?? []) {
        const oid = String(m.organization_id);
        const ts = (m.completed_at as string | null) ?? (m.scheduled_date as string | null);
        if (!ts) continue;
        if (!movesLastActivity[oid] || ts > movesLastActivity[oid]) {
          movesLastActivity[oid] = ts;
        }
      }
    }

    // Volume + revenue: last 30 days
    for (let i = 0; i < pmOrgIds.length; i += ORG_CHUNK) {
      const chunk = pmOrgIds.slice(i, i + ORG_CHUNK);
      const { data: rows } = await admin
        .from("moves")
        .select("organization_id, total_price")
        .in("organization_id", chunk)
        .gte("scheduled_date", thirtyDaysAgo)
        .in("status", PM_MOVE_STATUSES);

      for (const m of rows ?? []) {
        const oid = String(m.organization_id);
        movesVolume30d[oid] = (movesVolume30d[oid] || 0) + 1;
        movesRevenue30d[oid] = (movesRevenue30d[oid] || 0) + (Number(m.total_price) || 0);
      }
    }

    // Previous 30 days for trend
    for (let i = 0; i < pmOrgIds.length; i += ORG_CHUNK) {
      const chunk = pmOrgIds.slice(i, i + ORG_CHUNK);
      const { data: rows } = await admin
        .from("moves")
        .select("organization_id")
        .in("organization_id", chunk)
        .gte("scheduled_date", sixtyDaysAgo)
        .lt("scheduled_date", thirtyDaysAgo)
        .in("status", PM_MOVE_STATUSES);

      for (const m of rows ?? []) {
        const oid = String(m.organization_id);
        movesPrevVolume[oid] = (movesPrevVolume[oid] || 0) + 1;
      }
    }
  }

  // ── Deliveries data for non-PM orgs ───────────────────────────────────────
  const lastCompletedByOrg: Record<string, string> = {};
  const ORG_CHUNK = 50;
  for (let i = 0; i < deliveryOrgIds.length; i += ORG_CHUNK) {
    const chunk = deliveryOrgIds.slice(i, i + ORG_CHUNK);
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
    .in("organization_id", deliveryOrgIds.length > 0 ? deliveryOrgIds : ["__none__"])
    .gte("completed_at", thirtyDaysAgo)
    .in("status", COMPLETED_STATUSES);

  // Revenue by vertical, last 90 days
  let deliveries90: {
    organization_id: string;
    vertical_code?: string | null;
    base_price?: number | null;
    total_price?: number | null;
    admin_adjusted_price?: number | null;
  }[] = [];
  if (deliveryOrgIds.length > 0) {
    const vert90Res = await admin
      .from("deliveries")
      .select("organization_id, vertical_code, base_price, total_price, admin_adjusted_price")
      .in("organization_id", deliveryOrgIds)
      .gte("completed_at", ninetyDaysAgo)
      .in("status", COMPLETED_STATUSES);
    if (!vert90Res.error && Array.isArray(vert90Res.data)) {
      deliveries90 = vert90Res.data as typeof deliveries90;
    } else if (
      vert90Res.error &&
      !/vertical_code|column|does not exist/i.test(String(vert90Res.error.message || ""))
    ) {
      console.warn("[partners/health] deliveries 90d vertical query:", vert90Res.error.message);
    }
  }

  const { data: verticalNameRows } = await admin
    .from("delivery_verticals")
    .select("code, name")
    .eq("active", true);
  const verticalLabel = (code: string | null | undefined): string => {
    if (!code || !String(code).trim()) return "Other";
    const c = String(code);
    const hit = (verticalNameRows ?? []).find((r) => String((r as { code: string }).code) === c);
    if (hit && (hit as { name?: string }).name) return String((hit as { name: string }).name);
    return c.replace(/_/g, " ");
  };

  const verticalRevenueByOrg: Record<string, Record<string, number>> = {};
  for (const d of deliveries90) {
    const oid = d.organization_id;
    if (!oid) continue;
    const key = d.vertical_code && String(d.vertical_code).trim() ? String(d.vertical_code).trim() : "_other";
    if (!verticalRevenueByOrg[oid]) verticalRevenueByOrg[oid] = {};
    verticalRevenueByOrg[oid]![key] = (verticalRevenueByOrg[oid]![key] || 0) + deliveryRevenue(d);
  }

  // Previous 30 days (for trend) — delivery orgs only
  const { data: deliveriesPrev } = await admin
    .from("deliveries")
    .select("organization_id, status, completed_at")
    .in("organization_id", deliveryOrgIds.length > 0 ? deliveryOrgIds : ["__none__"])
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

  // ── Build partner rows ────────────────────────────────────────────────────
  const partners: PartnerHealthRow[] = (orgs ?? []).map((org) => {
    const pm = isPmType(org.type);

    // Last activity: moves for PM, deliveries for others
    const rowLast = org.last_delivery_at as string | null | undefined;
    const lastAt = pm
      ? (movesLastActivity[org.id] ?? null)
      : (rowLast ?? lastCompletedByOrg[org.id] ?? null);

    const vol = pm ? (movesVolume30d[org.id] || 0) : (volumeMap[org.id] || 0);
    const prevVol = pm ? (movesPrevVolume[org.id] || 0) : (prevVolumeMap[org.id] || 0);
    const rev = pm ? (movesRevenue30d[org.id] || 0) : (revenueMap[org.id] || 0);

    const daysSince = lastAt
      ? Math.floor((now.getTime() - new Date(lastAt).getTime()) / 86_400_000)
      : null;

    const displayType =
      (org as { vertical?: string | null }).vertical ||
      (org.type as string) ||
      "";

    const mixRaw = verticalRevenueByOrg[org.id] || {};
    const mixTotal = Object.values(mixRaw).reduce((a, b) => a + b, 0);
    const revenue_by_vertical_90d = Object.entries(mixRaw)
      .map(([code, revenue]) => ({
        code: code === "_other" ? "" : code,
        label: code === "_other" ? "Other" : verticalLabel(code),
        revenue: Math.round(revenue),
        pct: mixTotal > 0 ? Math.round((revenue / mixTotal) * 1000) / 10 : 0,
      }))
      .filter((x) => x.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);

    return {
      id: org.id,
      name: org.name,
      type: displayType,
      contact_name: org.contact_name,
      email: org.email,
      phone: org.phone,
      last_delivery_at: lastAt,
      health_status: getHealthStatus(lastAt, (org as { created_at?: string | null }).created_at ?? null),
      volume_30d: vol,
      revenue_30d: Math.round(rev),
      trend: getTrend(vol, prevVol),
      avg_rating: null,
      days_since_last: daysSince,
      revenue_by_vertical_90d,
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
