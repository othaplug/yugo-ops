import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { partnerMoveTrackingUrl } from "@/lib/partner/pm-track-url";

/** Month view of contract moves for PM partner calendar tab. */
export async function GET(req: NextRequest) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  const orgId = orgIds[0]!;

  const fromParam = req.nextUrl.searchParams.get("from");
  const toParam = req.nextUrl.searchParams.get("to");
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  const now = new Date();

  let start: string;
  let end: string;
  let year: number;
  let month: number;

  if (fromParam && toParam && ymd.test(fromParam) && ymd.test(toParam) && fromParam <= toParam) {
    start = fromParam;
    end = toParam;
    year = Number(start.slice(0, 4));
    month = Number(start.slice(5, 7));
  } else {
    const y = Number(req.nextUrl.searchParams.get("year"));
    const m = Number(req.nextUrl.searchParams.get("month"));
    year = Number.isFinite(y) ? y : now.getFullYear();
    month = Number.isFinite(m) && m >= 1 && m <= 12 ? m : now.getMonth() + 1;
    start = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }

  const admin = createAdminClient();

  const { data: props } = await admin
    .from("partner_properties")
    .select("id, building_name")
    .eq("partner_id", orgId);

  const propById = new Map((props ?? []).map((p) => [p.id as string, p.building_name as string]));

  const { data: globals } = await admin.from("pm_move_reasons").select("reason_code, label").is("partner_id", null);
  const { data: customs } = await admin
    .from("pm_move_reasons")
    .select("reason_code, label")
    .eq("partner_id", orgId)
    .eq("active", true);
  const reasonLabels: Record<string, string> = {};
  for (const g of globals ?? []) reasonLabels[g.reason_code as string] = g.label as string;
  for (const c of customs ?? []) reasonLabels[c.reason_code as string] = c.label as string;

  const { data: rows, error: qErr } = await admin
    .from("moves")
    .select(
      "id, move_code, status, scheduled_date, scheduled_time, unit_number, tenant_name, partner_property_id, pm_reason_code, pm_move_kind",
    )
    .eq("organization_id", orgId)
    .not("contract_id", "is", null)
    .gte("scheduled_date", start)
    .lte("scheduled_date", end)
    .order("scheduled_date", { ascending: true })
    .order("scheduled_time", { ascending: true })
    .limit(2500);

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 400 });
  }

  const terminal = new Set(["completed", "paid", "delivered", "cancelled"]);

  const byDate: Record<
    string,
    {
      id: string;
      move_code: string | null;
      scheduled_time: string | null;
      unit_number: string | null;
      tenant_name: string | null;
      building_name: string | null;
      status: string | null;
      move_type_label: string | null;
      tracking_url: string | null;
    }[]
  > = {};

  for (const m of rows ?? []) {
    const d = String(m.scheduled_date || "").slice(0, 10);
    if (!d) continue;
    if (!byDate[d]) byDate[d] = [];
    const pid = m.partner_property_id as string | null;
    const st = String(m.status || "").toLowerCase();
    const open = !terminal.has(st);
    byDate[d].push({
      id: m.id as string,
      move_code: m.move_code as string | null,
      scheduled_time: m.scheduled_time as string | null,
      unit_number: m.unit_number as string | null,
      tenant_name: m.tenant_name as string | null,
      building_name: pid ? propById.get(pid) ?? null : null,
      status: m.status as string | null,
      move_type_label:
        reasonLabels[(m.pm_reason_code as string) || ""] ||
        reasonLabels[(m.pm_move_kind as string) || ""] ||
        null,
      tracking_url:
        open && m.id
          ? partnerMoveTrackingUrl({ id: m.id as string, move_code: m.move_code as string | null })
          : null,
    });
  }

  return NextResponse.json({
    year,
    month,
    start,
    end,
    movesByDate: byDate,
  });
}
