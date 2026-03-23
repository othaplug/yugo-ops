import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/partner-auth";

function monthKeysLast6(from: Date): string[] {
  const keys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

function effectiveMonthKey(scheduledDate: string | null, createdAt: string | null): string | null {
  const raw = scheduledDate?.trim() || createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** GET /api/partner/spend-summary — delivery spend by month (last 6) and counts for the partner org(s). */
export async function GET() {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  if (!orgIds.length) {
    return NextResponse.json({ error: "No organization linked" }, { status: 403 });
  }

  const supabase = await createClient();
  const now = new Date();
  const keys = monthKeysLast6(now);
  const keySet = new Set(keys);

  const [{ data: deliveries, error: delErr }, { count: deliveryCount, error: dcErr }, { count: invoiceCount, error: invErr }] =
    await Promise.all([
      supabase
        .from("deliveries")
        .select("total_price, scheduled_date, created_at")
        .in("organization_id", orgIds),
      supabase.from("deliveries").select("id", { count: "exact", head: true }).in("organization_id", orgIds),
      supabase.from("invoices").select("id", { count: "exact", head: true }).in("organization_id", orgIds),
    ]);

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }
  if (dcErr) {
    return NextResponse.json({ error: dcErr.message }, { status: 500 });
  }
  const safeInvoiceCount = invErr ? 0 : invoiceCount ?? 0;
  if (invErr) {
    console.warn("[spend-summary] invoice count skipped:", invErr.message);
  }

  const monthlyTotals = new Map<string, number>();
  for (const k of keys) monthlyTotals.set(k, 0);

  for (const row of deliveries || []) {
    const mk = effectiveMonthKey(row.scheduled_date ?? null, row.created_at ?? null);
    if (!mk || !keySet.has(mk)) continue;
    const n = Number(row.total_price ?? 0);
    if (Number.isNaN(n)) continue;
    monthlyTotals.set(mk, (monthlyTotals.get(mk) ?? 0) + n);
  }

  const monthlySpend = keys.map((month) => ({
    month,
    total: Math.round((monthlyTotals.get(month) ?? 0) * 100) / 100,
  }));

  const totalSpend = Math.round(monthlySpend.reduce((s, m) => s + m.total, 0) * 100) / 100;

  return NextResponse.json({
    monthlySpend,
    totalSpend,
    deliveryCount: deliveryCount ?? 0,
    invoiceCount: safeInvoiceCount,
  });
}
