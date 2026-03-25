import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { normalizeDeliveryStatus } from "@/lib/crew-tracking-status";

const NAV_STATUSES = new Set(["en_route_to_pickup", "en_route_to_destination"]);

function normalizeStatus(raw: string, jobType: "move" | "delivery"): string {
  return jobType === "delivery" ? normalizeDeliveryStatus(raw) : raw;
}

/** GET — crew deep link to open turn-by-turn navigation for the active en-route session (if any). */
export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("tracking_sessions")
    .select("job_id, job_type, status, is_active, updated_at")
    .eq("team_id", payload.teamId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(25);

  if (error) {
    console.error("[crew/nav-target]", error);
    return NextResponse.json({ path: null });
  }

  for (const row of rows || []) {
    const jobType = row.job_type as "move" | "delivery";
    if (jobType !== "move" && jobType !== "delivery") continue;
    const st = normalizeStatus(String(row.status || ""), jobType);
    if (!NAV_STATUSES.has(st)) continue;

    const jobId = String(row.job_id || "").trim();
    if (!jobId) continue;

    if (jobType === "delivery") {
      const { data: d } = await admin.from("deliveries").select("id, crew_id").eq("id", jobId).maybeSingle();
      if (!d || d.crew_id !== payload.teamId) continue;
    } else {
      const { data: m } = await admin.from("moves").select("id, crew_id").eq("id", jobId).maybeSingle();
      if (!m || m.crew_id !== payload.teamId) continue;
    }

    const path = `/crew/dashboard/job/${jobType}/${jobId}?nav=1`;
    return NextResponse.json({ path });
  }

  return NextResponse.json({ path: null });
}
