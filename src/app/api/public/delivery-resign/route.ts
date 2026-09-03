import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyResignToken } from "@/lib/track-token";

/**
 * Client-facing recovery: the person who received the delivery
 * (Andre-on-DLV-30412 scenario) re-signs the sign-off from their own
 * phone after a lost-in-flight crew signature. Uses the same
 * client_sign_offs shape as the crew route so downstream analytics and
 * proof-of-delivery treat the recovery signature identically to a
 * crew-captured one.
 */
export async function POST(req: NextRequest) {
  let body: {
    deliveryId?: string;
    token?: string;
    signedBy?: string;
    signatureDataUrl?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deliveryId = (body.deliveryId || "").trim();
  const token = (body.token || "").trim();
  const signedBy = (body.signedBy || "").trim();
  const signatureDataUrl = (body.signatureDataUrl || "").trim();

  if (!deliveryId || !token) {
    return NextResponse.json({ error: "Missing deliveryId or token" }, { status: 400 });
  }
  if (!signedBy || !signatureDataUrl) {
    return NextResponse.json({ error: "Name and signature required" }, { status: 400 });
  }

  const fullToken = `${deliveryId}.${token}`;
  const verified = verifyResignToken(fullToken);
  if (!verified || verified !== deliveryId) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: delivery } = await admin
    .from("deliveries")
    .select("id, delivery_number, signoff_completed_at")
    .eq("id", deliveryId)
    .maybeSingle();
  if (!delivery) {
    return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
  }

  const now = new Date().toISOString();

  // Idempotent by the token itself — if this token was already used to
  // resign, return success without inserting a duplicate row.
  const { data: prior } = await admin
    .from("client_sign_offs")
    .select("id, signed_at")
    .eq("idempotency_key", `resign:${deliveryId}`)
    .maybeSingle();
  if (prior) {
    return NextResponse.json({ ok: true, id: prior.id, alreadySigned: true });
  }

  const { data: inserted, error } = await admin
    .from("client_sign_offs")
    .insert({
      job_id: delivery.id,
      job_type: "delivery",
      signed_by: signedBy,
      signature_data_url: signatureDataUrl,
      all_items_received: true,
      condition_accepted: true,
      no_damages: true,
      no_property_damage: true,
      crew_conducted_professionally: true,
      walkthrough_completed: true,
      photos_reviewed_by_client: true,
      feedback_note: "Client resigned via recovery link after crew-app signature loss.",
      idempotency_key: `resign:${deliveryId}`,
    })
    .select("id, signed_at")
    .single();

  if (error) {
    console.error("[delivery-resign] insert failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Stamp the sticky signoff flag so every finance / dispatch surface
  // treats the delivery as fully closed.
  await admin
    .from("deliveries")
    .update({ signoff_completed_at: inserted.signed_at ?? now })
    .eq("id", deliveryId);

  // Proof of delivery record so the recovered signature shows up on
  // the delivery's Files tab like a normal PoD.
  try {
    await admin.from("proof_of_delivery").insert({
      delivery_id: deliveryId,
      signature_data: signatureDataUrl,
      signer_name: signedBy,
      signed_at: inserted.signed_at ?? now,
      photos_pickup: [],
      photos_transit: [],
      photos_delivery: [],
      item_conditions: [],
      crew_members: [],
    });
  } catch (e) {
    console.error("[delivery-resign] PoD insert failed (non-fatal):", e);
  }

  try {
    await admin.from("status_events").insert({
      entity_type: "delivery",
      entity_id: delivery.id,
      event_type: "signoff_recovered",
      description: `Client resigned via recovery link: ${signedBy}`,
      icon: "user-check",
    });
  } catch {}

  return NextResponse.json({ ok: true, id: inserted.id });
}
