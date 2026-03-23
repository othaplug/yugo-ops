import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDrivingTrafficBrief, type DrivingTrafficBrief } from "@/lib/mapbox/driving-traffic-brief";
import { rateLimit } from "@/lib/rate-limit";

function routablePair(from: string, to: string): boolean {
  const f = from?.trim();
  const t = to?.trim();
  if (!f || !t) return false;
  if (f.length < 4 || t.length < 4) return false;
  return true;
}

/**
 * POST { moveIds: string[] } — Mapbox driving-traffic briefs for Command Center (moves only).
 * Max 12 IDs; staff only.
 */
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireAdmin();
  if (authError) return authError;

  const rl = rateLimit(`admin-cc-traffic:${user!.id}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const rawIds = (body as { moveIds?: unknown })?.moveIds;
  if (!Array.isArray(rawIds)) {
    return NextResponse.json({ error: "moveIds array required" }, { status: 400 });
  }

  const moveIds = [...new Set(rawIds.map((x) => String(x)).filter(Boolean))].slice(0, 12);
  if (moveIds.length === 0) {
    return NextResponse.json({ traffic: {} as Record<string, DrivingTrafficBrief> });
  }

  const db = createAdminClient();
  const { data: moves, error } = await db
    .from("moves")
    .select("id, from_address, to_address, delivery_address")
    .in("id", moveIds);

  if (error) {
    return NextResponse.json({ error: "Failed to load moves" }, { status: 500 });
  }

  const traffic: Record<string, DrivingTrafficBrief> = {};

  for (const m of moves || []) {
    const from = String(m.from_address || "");
    const toRaw = m.to_address != null && String(m.to_address).trim() ? String(m.to_address) : String(m.delivery_address || "");
    if (!routablePair(from, toRaw)) continue;
    try {
      const brief = await getDrivingTrafficBrief(from, toRaw);
      if (brief) traffic[String(m.id)] = brief;
    } catch {
      /* skip */
    }
  }

  return NextResponse.json({ traffic });
}
