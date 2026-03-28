import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { getTodayString } from "@/lib/business-timezone";

export const dynamic = "force-dynamic";

export async function GET() {
  const { error } = await requireStaff();
  if (error) return error;

  const sb = createAdminClient();
  const today = getTodayString();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const { data: monthLeads, error: mErr } = await sb
    .from("leads")
    .select("id, status, source, created_at, first_response_at, response_time_seconds, estimated_value")
    .gte("created_at", monthStart + "T00:00:00.000Z");

  if (mErr) {
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  const { data: recentActivityRows, error: raErr } = await sb
    .from("lead_activities")
    .select(
      "id, activity_type, notes, created_at, lead_id, leads(lead_number, first_name, last_name)",
    )
    .order("created_at", { ascending: false })
    .limit(20);

  const leads = monthLeads ?? [];
  const todayLeads = leads.filter((l) => String(l.created_at || "").slice(0, 10) === today);

  const todayByStatus: Record<string, number> = {};
  for (const l of todayLeads) {
    const s = (l.status as string) || "new";
    todayByStatus[s] = (todayByStatus[s] || 0) + 1;
  }

  const withResponse = leads.filter((l) => l.first_response_at);
  const avgSec =
    withResponse.length > 0
      ? withResponse.reduce((s, l) => s + (Number(l.response_time_seconds) || 0), 0) / withResponse.length
      : null;

  const pctUnder = (maxSec: number) => {
    if (withResponse.length === 0) return null;
    const n = withResponse.filter((l) => Number(l.response_time_seconds) <= maxSec).length;
    return Math.round((n / withResponse.length) * 100);
  };

  const funnel = {
    received: leads.length,
    contacted: leads.filter((l) =>
      [
        "contacted",
        "qualified",
        "quote_sent",
        "follow_up",
        "converted",
        "follow_up_sent",
        "awaiting_reply",
      ].includes(String(l.status)),
    ).length,
    quote_sent: leads.filter((l) =>
      ["quote_sent", "follow_up", "converted"].includes(String(l.status)),
    ).length,
    converted: leads.filter((l) => String(l.status) === "converted").length,
    lost: leads.filter((l) => String(l.status) === "lost").length,
    stale: leads.filter((l) => String(l.status) === "stale").length,
  };

  const bySource: Record<string, { count: number; converted: number; valueSum: number }> = {};
  for (const l of leads) {
    const src = String(l.source || "other");
    if (!bySource[src]) bySource[src] = { count: 0, converted: 0, valueSum: 0 };
    bySource[src].count++;
    if (l.status === "converted") bySource[src].converted++;
    bySource[src].valueSum += Number(l.estimated_value) || 0;
  }

  const inBucket = (r: number, lo: number, hi: number) => r >= lo && r <= hi;

  const speedVsConversion = [
    {
      label: "<5 min",
      subset: leads.filter((l) => {
        const r = Number(l.response_time_seconds);
        return !Number.isNaN(r) && r <= 300;
      }),
    },
    {
      label: "5–15 min",
      subset: leads.filter((l) => {
        const r = Number(l.response_time_seconds);
        return !Number.isNaN(r) && inBucket(r, 301, 900);
      }),
    },
    {
      label: "15–60 min",
      subset: leads.filter((l) => {
        const r = Number(l.response_time_seconds);
        return !Number.isNaN(r) && inBucket(r, 901, 3600);
      }),
    },
    {
      label: "1hr+",
      subset: leads.filter((l) => {
        const r = Number(l.response_time_seconds);
        return !Number.isNaN(r) && r > 3600;
      }),
    },
  ].map(({ label, subset }) => {
    const conv = subset.filter((l) => l.status === "converted").length;
    return {
      label,
      leads: subset.length,
      converted: conv,
      rate: subset.length ? Math.round((conv / subset.length) * 100) : 0,
    };
  });

  const recentActivity =
    raErr || !recentActivityRows
      ? []
      : recentActivityRows.map((row) => {
          const lead = row.leads as { lead_number?: string; first_name?: string; last_name?: string } | null;
          const name = [lead?.first_name, lead?.last_name].filter(Boolean).join(" ") || "—";
          return {
            id: row.id,
            activity_type: row.activity_type,
            notes: row.notes,
            created_at: row.created_at,
            lead_id: row.lead_id,
            lead_number: lead?.lead_number ?? null,
            lead_name: name,
          };
        });

  return NextResponse.json({
    todayByStatus,
    avgResponseMin: avgSec != null ? Math.round(avgSec / 60) : null,
    pctUnder5min: pctUnder(300),
    pctUnder15min: pctUnder(900),
    pctOver1hr: withResponse.length
      ? Math.round(
          (withResponse.filter((l) => Number(l.response_time_seconds) > 3600).length / withResponse.length) *
            100,
        )
      : null,
    funnel,
    bySource,
    speedVsConversion,
    recentActivity,
  });
}
