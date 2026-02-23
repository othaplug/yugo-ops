import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const jobType = (req.nextUrl.searchParams.get("jobType")) || "move";

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
  let entityId = jobId;
  if (!isUuid) {
    const { data: move } = await admin.from("moves").select("id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).maybeSingle();
    const { data: delivery } = await admin.from("deliveries").select("id").ilike("delivery_number", jobId).maybeSingle();
    entityId = move?.id || delivery?.id || jobId;
  }

  const { data } = await admin
    .from("client_sign_offs")
    .select("id, signed_by, signed_at, all_items_received, condition_accepted, satisfaction_rating, would_recommend, feedback_note, exceptions")
    .eq("job_id", entityId)
    .eq("job_type", jobType)
    .maybeSingle();

  return NextResponse.json(data || null);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const body = await req.json();
  const jobType = (body.jobType || "move") as "move" | "delivery";
  const signedBy = (body.signedBy || body.signed_by || "").toString().trim();
  const signatureDataUrl = (body.signatureDataUrl || body.signature_data_url || "").toString().trim();
  const allItemsReceived = body.allItemsReceived !== undefined ? !!body.allItemsReceived : (body.all_items_received !== undefined ? !!body.all_items_received : true);
  const conditionAccepted = body.conditionAccepted !== undefined ? !!body.conditionAccepted : (body.condition_accepted !== undefined ? !!body.condition_accepted : true);
  const satisfactionRating = body.satisfactionRating ?? body.satisfaction_rating;
  const wouldRecommend = body.wouldRecommend ?? body.would_recommend;
  const feedbackNote = (body.feedbackNote || body.feedback_note || "").toString().trim() || null;
  const exceptions = (body.exceptions || "").toString().trim() || null;

  if (!signedBy || !signatureDataUrl) {
    return NextResponse.json({ error: "Name and signature required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
  let entityId: string;

  if (jobType === "move") {
    const { data: move } = isUuid
      ? await admin.from("moves").select("id, crew_id").eq("id", jobId).single()
      : await admin.from("moves").select("id, crew_id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).single();
    if (!move || move.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    entityId = move.id;
  } else {
    const { data: delivery } = isUuid
      ? await admin.from("deliveries").select("id, crew_id").eq("id", jobId).single()
      : await admin.from("deliveries").select("id, crew_id").ilike("delivery_number", jobId).single();
    if (!delivery || delivery.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    entityId = delivery.id;
  }

  const { data: existing } = await admin
    .from("client_sign_offs")
    .select("id")
    .eq("job_id", entityId)
    .eq("job_type", jobType)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "Sign-off already recorded" }, { status: 400 });

  const { data: inserted, error } = await admin
    .from("client_sign_offs")
    .insert({
      job_id: entityId,
      job_type: jobType,
      signed_by: signedBy,
      signature_data_url: signatureDataUrl,
      all_items_received: allItemsReceived,
      condition_accepted: conditionAccepted,
      satisfaction_rating: satisfactionRating >= 1 && satisfactionRating <= 5 ? satisfactionRating : null,
      would_recommend: wouldRecommend,
      feedback_note: feedbackNote,
      exceptions,
    })
    .select("id, signed_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Complete the job — find active tracking session and mark completed
  const { data: activeSession } = await admin
    .from("tracking_sessions")
    .select("id")
    .eq("job_id", entityId)
    .eq("job_type", jobType)
    .eq("is_active", true)
    .maybeSingle();

  if (activeSession) {
    const now = new Date().toISOString();
    await admin
      .from("tracking_sessions")
      .update({ status: "completed", is_active: false, completed_at: now, updated_at: now })
      .eq("id", activeSession.id);
    const table = jobType === "move" ? "moves" : "deliveries";
    await admin
      .from(table)
      .update({
        status: jobType === "move" ? "completed" : "delivered",
        stage: "completed",
        updated_at: now,
      })
      .eq("id", entityId);
  }

  return NextResponse.json(inserted);
}
