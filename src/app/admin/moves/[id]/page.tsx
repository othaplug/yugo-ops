import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { isMoveIdUuid, getMoveDetailPath } from "@/lib/move-code";
import MoveDetailClient from "./MoveDetailClient";
import { canEditFinalJobPrice } from "@/lib/admin-can-edit-final-price";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const slug = (await params).id?.trim() || "";
  const db = createAdminClient();
  const byUuid = isMoveIdUuid(slug);
  const { data: move } = await (byUuid
    ? db
        .from("moves")
        .select("id, move_code, service_type, move_type")
        .eq("id", slug)
        .single()
    : db
        .from("moves")
        .select("id, move_code, service_type, move_type")
        .ilike("move_code", slug.replace(/^#/, "").toUpperCase())
        .single());
  if (
    move &&
    (String(move.service_type ?? "").toLowerCase() === "bin_rental" ||
      String(move.move_type ?? "").toLowerCase() === "bin_rental")
  ) {
    const { data: bo } = await db
      .from("bin_orders")
      .select("order_number")
      .eq("move_id", move.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (bo?.order_number) return { title: `Bin order ${bo.order_number}` };
    return { title: "Bin rental" };
  }
  const name = move?.move_code ? `Move ${move.move_code}` : "Move";
  return { title: name };
}

export default async function MoveDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const slug = (await params).id?.trim() || "";
  const supabase = await createClient();
  const db = createAdminClient();
  const byUuid = isMoveIdUuid(slug);
  const [{ data: move, error }, { data: crews }] = await Promise.all([
    byUuid
      ? db.from("moves").select("*").eq("id", slug).single()
      : db
          .from("moves")
          .select("*")
          .ilike("move_code", slug.replace(/^#/, "").toUpperCase())
          .single(),
    db.from("crews").select("id, name, members").order("name"),
  ]);

  if (error || !move) notFound();

  if (
    String(move.service_type ?? "").toLowerCase() === "bin_rental" ||
    String(move.move_type ?? "").toLowerCase() === "bin_rental"
  ) {
    const { data: binOrder } = await db
      .from("bin_orders")
      .select("id")
      .eq("move_id", move.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (binOrder?.id) {
      redirect(`/admin/bin-rentals/${binOrder.id}`);
    }
    redirect("/admin/bin-rentals");
  }

  if (byUuid && move.move_code?.trim()) {
    redirect(getMoveDetailPath(move));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: pu } = await db
    .from("platform_users")
    .select("role")
    .eq("user_id", user?.id ?? "")
    .single();
  const userRole = pu?.role ?? "viewer";
  const canEditPostCompletionPrice = canEditFinalJobPrice(
    pu?.role ?? null,
    user?.email ?? null,
  );

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
    { data: moveWaiverRows },
  ] = await Promise.all([
    db
      .from("move_change_requests")
      .select("fee_cents")
      .eq("move_id", move.id)
      .eq("status", "approved"),
    db
      .from("extra_items")
      .select("fee_cents")
      .eq("job_id", move.id)
      .eq("job_type", "move")
      .eq("status", "approved"),
    db
      .from("eta_sms_log")
      .select("message_type, sent_at, eta_minutes, twilio_sid")
      .eq("move_id", move.id)
      .order("sent_at", { ascending: false }),
    db
      .from("review_requests")
      .select(
        "id, status, email_sent_at, reminder_sent_at, review_clicked, review_clicked_at, client_rating, client_feedback",
      )
      .eq("move_id", move.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("item_weights")
      .select(
        "slug, item_name, weight_score, category, room, is_common, display_order, active",
      )
      .eq("active", true)
      .order("display_order"),
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
    db
      .from("bin_orders")
      .select("*")
      .eq("move_id", move.id)
      .order("created_at", { ascending: false }),
    db
      .from("move_survey_photos")
      .select("id, room, photo_url, notes, uploaded_at")
      .eq("move_id", move.id)
      .order("uploaded_at", { ascending: false }),
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
    db
      .from("move_waivers")
      .select(
        "id, category, item_name, description, crew_recommendation, reported_by_name, status, signed_by, signed_at, signature_data, photo_urls",
      )
      .eq("move_id", move.id)
      .order("created_at", { ascending: false }),
  ]);
  const changeFeesCents = (approvedChanges ?? []).reduce(
    (s, r) => s + (Number(r.fee_cents) || 0),
    0,
  );
  const extraFeesCents = (approvedExtras ?? []).reduce(
    (s, r) => s + (Number(r.fee_cents) || 0),
    0,
  );
  const additionalFeesCents = changeFeesCents + extraFeesCents;

  const linkId = (move as { linked_move_id?: string | null }).linked_move_id;
  const [{ data: pmLinkedPeer }, { data: partnerOrgRow }] = await Promise.all([
    linkId
      ? db
          .from("moves")
          .select("id, move_code, scheduled_date, client_name, status")
          .eq("id", linkId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    (move as { organization_id?: string | null }).organization_id
      ? db
          .from("organizations")
          .select("name")
          .eq("id", (move as { organization_id: string }).organization_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const partnerOrgName = (partnerOrgRow as { name?: string } | null)?.name ?? null;

  const moveWaivers = await Promise.all(
    (moveWaiverRows ?? []).map(
      async (w: {
        id: string;
        category: string;
        item_name: string;
        description: string;
        crew_recommendation: string | null;
        reported_by_name: string | null;
        status: string;
        signed_by: string | null;
        signed_at: string | null;
        signature_data: string | null;
        photo_urls: string[] | null;
      }) => {
        const paths = Array.isArray(w.photo_urls) ? w.photo_urls : [];
        const photoUrlsSigned = await Promise.all(
          paths.map(async (path) => {
            const { data } = await db.storage
              .from("job-photos")
              .createSignedUrl(path, 7200);
            return data?.signedUrl ?? "";
          }),
        );
        return {
          id: w.id,
          category: w.category,
          item_name: w.item_name,
          description: w.description,
          crew_recommendation: w.crew_recommendation,
          reported_by_name: w.reported_by_name,
          status: w.status,
          signed_by: w.signed_by,
          signed_at: w.signed_at,
          signature_data: w.signature_data,
          photoUrlsSigned,
        };
      },
    ),
  );

  return (
    <MoveDetailClient
      move={move}
      pmLinkedPeer={pmLinkedPeer}
      partnerOrgName={partnerOrgName}
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
      moveWaivers={moveWaivers}
    />
  );
}
