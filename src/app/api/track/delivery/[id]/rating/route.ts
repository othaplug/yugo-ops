import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyDeliveryTrackAccess } from "@/lib/delivery-tracking-tokens";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!(await verifyDeliveryTrackAccess(id, token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("proof_of_delivery")
    .select("satisfaction_rating, satisfaction_comment")
    .eq("delivery_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json(data || { satisfaction_rating: null });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const token = body.token || "";

  if (!(await verifyDeliveryTrackAccess(id, token))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rating = Number(body.rating);
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Try to update existing PoD record
  const { data: existing } = await admin
    .from("proof_of_delivery")
    .select("id")
    .eq("delivery_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    await admin
      .from("proof_of_delivery")
      .update({
        satisfaction_rating: rating,
        satisfaction_comment: body.comment || null,
      })
      .eq("id", existing.id);
  } else {
    await admin.from("proof_of_delivery").insert({
      delivery_id: id,
      satisfaction_rating: rating,
      satisfaction_comment: body.comment || null,
    });
  }

  // Also update client_sign_offs if exists
  await admin
    .from("client_sign_offs")
    .update({ satisfaction_rating: rating, feedback_note: body.comment || null })
    .eq("job_id", id)
    .eq("job_type", "delivery");

  return NextResponse.json({ ok: true });
}
