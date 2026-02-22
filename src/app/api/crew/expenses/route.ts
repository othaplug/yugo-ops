import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

const CATEGORIES = ["parking", "supplies", "fuel", "tolls", "food", "other"] as const;

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = req.nextUrl.searchParams.get("today");
  const admin = createAdminClient();
  let query = admin
    .from("crew_expenses")
    .select("id, job_id, amount_cents, category, description, receipt_storage_path, submitted_at, status")
    .eq("team_id", payload.teamId)
    .order("submitted_at", { ascending: false });

  if (today === "true") {
    const d = new Date().toISOString().split("T")[0];
    query = query.gte("submitted_at", d).lte("submitted_at", d + "T23:59:59.999Z");
  }

  const { data, error } = await query.limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const totalToday = today === "true" && data
    ? data.reduce((s, e) => s + (e.amount_cents || 0), 0)
    : 0;

  return NextResponse.json({ expenses: data || [], totalTodayCents: totalToday });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const rawAmount = body.amountCents ?? body.amount_cents;
  const amountCents = rawAmount != null
    ? Math.round(Number(rawAmount))
    : Math.round(parseFloat(String(body.amount || 0)) * 100);
  const category = (body.category || "").toString().trim();
  const description = (body.description || "").toString().trim();
  const jobId = (body.jobId || body.job_id || "").toString().trim() || null;
  const receiptStoragePath = (body.receiptStoragePath || body.receipt_storage_path || "").toString().trim() || null;

  if (amountCents <= 0 || !description) {
    return NextResponse.json({ error: "Amount and description required" }, { status: 400 });
  }
  if (!CATEGORIES.includes(category as (typeof CATEGORIES)[number])) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("crew_expenses")
    .insert({
      team_id: payload.teamId,
      submitted_by: payload.crewMemberId,
      job_id: jobId,
      amount_cents: amountCents,
      category: category as (typeof CATEGORIES)[number],
      description,
      receipt_storage_path: receiptStoragePath,
      status: "pending",
    })
    .select("id, amount_cents, category, description, receipt_storage_path, status, submitted_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
