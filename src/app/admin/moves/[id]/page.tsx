import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { isMoveIdUuid, getMoveDetailPath } from "@/lib/move-code";
import MoveDetailClient from "./MoveDetailClient";
import { canEditFinalJobPrice } from "@/lib/admin-can-edit-final-price";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const slug = (await params).id?.trim() || "";
  const db = createAdminClient();
  const byUuid = isMoveIdUuid(slug);
  const { data: move } = await (byUuid
    ? db.from("moves").select("move_code").eq("id", slug).single()
    : db.from("moves").select("move_code").ilike("move_code", slug.replace(/^#/, "").toUpperCase()).single());
  const name = move?.move_code ? `Move ${move.move_code}` : "Move";
  return { title: name };
}

export default async function MoveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const slug = (await params).id?.trim() || "";
  const supabase = await createClient();
  const db = createAdminClient();
  const byUuid = isMoveIdUuid(slug);
  const [{ data: move, error }, { data: crews }] = await Promise.all([
    byUuid
      ? db.from("moves").select("*").eq("id", slug).single()
      : db.from("moves").select("*").ilike("move_code", slug.replace(/^#/, "").toUpperCase()).single(),
    db.from("crews").select("id, name, members").order("name"),
  ]);

  if (error || !move) notFound();

  if (byUuid && move.move_code?.trim()) {
    redirect(getMoveDetailPath(move));
  }

  const { data: { user } } = await supabase.auth.getUser();
  const { data: pu } = await db.from("platform_users").select("role").eq("user_id", user?.id ?? "").single();
  const userRole = pu?.role ?? "viewer";
  const canEditPostCompletionPrice = canEditFinalJobPrice(pu?.role ?? null, user?.email ?? null);

  const isOffice = move.move_type === "office";

  const [
    { data: approvedChanges },
    { data: approvedExtras },
    { data: etaSmsLog },
    { data: reviewRequest },
    { data: itemWeights },
    { data: pendingInventoryChange },
    { data: paymentLedger },
    { data: moveStatusEvents },
    { data: linkedBinOrders },
    { data: surveyPhotos },
    { data: pendingModifications },
    { data: postCompletionPriceEdits },
  ] = await Promise.all([
    db.from("move_change_requests").select("fee_cents").eq("move_id", move.id).eq("status", "approved"),
    db.from("extra_items").select("fee_cents").eq("job_id", move.id).eq("job_type", "move").eq("status", "approved"),
    db.from("eta_sms_log").select("message_type, sent_at, eta_minutes, twilio_sid").eq("move_id", move.id).order("sent_at", { ascending: false }),
    db.from("review_requests").select("id, status, email_sent_at, reminder_sent_at, review_clicked, review_clicked_at, client_rating, client_feedback").eq("move_id", move.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("item_weights").select("slug, item_name, weight_score, category, room, is_common, display_order, active").eq("active", true).order("display_order"),
    move.pending_inventory_change_request_id
      ? db
          .from("inventory_change_requests")
          .select(
            "id, status, submitted_at, items_added, items_removed, auto_calculated_delta, admin_adjusted_delta, truck_assessment, admin_notes, decline_reason, source",
          )
          .eq("id", move.pending_inventory_change_request_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("move_payment_ledger")
      .select(
        "id, label, entry_type, pre_tax_amount, hst_amount, paid_at, settlement_method, square_payment_id, inventory_change_request_id",
      )
      .eq("move_id", move.id)
      .order("paid_at", { ascending: true }),
    db
      .from("status_events")
      .select("event_type, created_at")
      .eq("entity_type", "move")
      .eq("entity_id", move.id)
      .order("created_at", { ascending: true }),
    db.from("bin_orders").select("*").eq("move_id", move.id).order("created_at", { ascending: false }),
    db.from("move_survey_photos").select("id, room, photo_url, notes, uploaded_at").eq("move_id", move.id).order("uploaded_at", { ascending: false }),
    db
      .from("move_modifications")
      .select("id, type, status, price_difference, created_at")
      .eq("move_id", move.id)
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false })
      .limit(5),
    db
      .from("job_final_price_edits")
      .select(
        "id, original_price, new_price, difference, reason, edited_by_name, created_at, invoice_may_need_reissue",
      )
      .eq("job_id", move.id)
      .eq("job_type", "move")
      .order("created_at", { ascending: false }),
  ]);
  const changeFeesCents = (approvedChanges ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0);
  const extraFeesCents = (approvedExtras ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0);
  const additionalFeesCents = changeFeesCents + extraFeesCents;

  return (
    <MoveDetailClient
      move={move}
      crews={crews ?? []}
      isOffice={isOffice}
      userRole={userRole}
      additionalFeesCents={additionalFeesCents}
      etaSmsLog={etaSmsLog ?? []}
      reviewRequest={reviewRequest ?? undefined}
      itemWeights={itemWeights ?? []}
      pendingInventoryChange={pendingInventoryChange ?? undefined}
      paymentLedger={paymentLedger ?? []}
      moveStatusEvents={moveStatusEvents ?? []}
      linkedBinOrders={linkedBinOrders ?? []}
      surveyPhotos={surveyPhotos ?? []}
      pendingModifications={pendingModifications ?? []}
      canEditPostCompletionPrice={canEditPostCompletionPrice}
      postCompletionPriceEdits={postCompletionPriceEdits ?? []}
    />
  );
}
