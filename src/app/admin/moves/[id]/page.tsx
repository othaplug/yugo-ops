import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notFound, redirect } from "next/navigation";
import { isMoveIdUuid, getMoveDetailPath } from "@/lib/move-code";
import MoveDetailClient from "./MoveDetailClient";
import { canEditFinalJobPrice } from "@/lib/admin-can-edit-final-price";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { fetchMoveProjectWithTree } from "@/lib/move-projects/fetch";

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

  // Self-heal: backfill est_hours / estimated_duration_minutes from the linked
  // quote ONLY when the move is missing them. This handles legacy moves created
  // before the quote→move sync was wired up.
  //
  // Important: we no longer overwrite values that differ from the quote, because
  // the EditMoveDetailsModal lets a coordinator manually override the allocated
  // job time (and it writes est_hours + estimated_duration_minutes in lockstep).
  // The previous heuristic ("drift > 0.01h" / ">5 min") silently reverted those
  // manual edits on the very next page load. If quote.est_hours is the source
  // of truth, it should be the source of truth at the moment of move creation —
  // not on every read.
  const moveQuoteId = (move as { quote_id?: string | null }).quote_id;
  // Multi-origin / multi-destination addresses live on the linked quote.
  // Hoist them onto the move object so MoveDetailClient can render every
  // pickup, not just the primary. Previously the move detail page only
  // showed the primary from/to, hiding any extras the client booked.
  let linkedAdditionalOrigins:
    | { address?: string | null }[]
    | null = null;
  let linkedAdditionalDestinations:
    | { address?: string | null }[]
    | null = null;
  if (moveQuoteId) {
    const { data: linkedQuote } = await db
      .from("quotes")
      .select("est_hours, additional_origins, additional_destinations")
      .eq("id", moveQuoteId)
      .maybeSingle();
    linkedAdditionalOrigins = Array.isArray(linkedQuote?.additional_origins)
      ? (linkedQuote.additional_origins as { address?: string | null }[])
      : null;
    linkedAdditionalDestinations = Array.isArray(
      linkedQuote?.additional_destinations,
    )
      ? (linkedQuote.additional_destinations as {
          address?: string | null;
        }[])
      : null;
    const qehRaw = linkedQuote?.est_hours;
    const qeh =
      qehRaw != null && Number.isFinite(Number(qehRaw)) && Number(qehRaw) > 0
        ? Number(qehRaw)
        : null;
    if (qeh != null) {
      const expectedMinutes = Math.round(qeh * 60);
      const currentEstHoursRaw = (
        move as { est_hours?: number | string | null }
      ).est_hours;
      const currentEstHours = Number(currentEstHoursRaw ?? 0);
      const currentMinutesRaw = (
        move as { estimated_duration_minutes?: number | null }
      ).estimated_duration_minutes;
      const currentMinutes = Number(currentMinutesRaw ?? 0);
      // "Missing" = null/undefined or zero. Any positive value (including a
      // value that differs from the quote) is treated as intentional and
      // left alone.
      const estHoursMissing =
        currentEstHoursRaw == null || !Number.isFinite(currentEstHours) || currentEstHours <= 0;
      const minutesMissing =
        currentMinutesRaw == null || !Number.isFinite(currentMinutes) || currentMinutes <= 0;
      const isImmutable = ["completed", "cancelled", "no_show"].includes(
        String((move as { status?: string }).status ?? "").toLowerCase(),
      );
      if ((estHoursMissing || minutesMissing) && !isImmutable) {
        const patch: Record<string, unknown> = {};
        if (estHoursMissing) patch.est_hours = qeh;
        if (minutesMissing) patch.estimated_duration_minutes = expectedMinutes;
        await db
          .from("moves")
          .update(patch)
          .eq("id", (move as { id: string }).id);
        // Patch the in-memory copy so the rendered page matches DB without re-fetch
        if (estHoursMissing) {
          (move as Record<string, unknown>).est_hours = qeh;
        }
        if (minutesMissing) {
          (move as Record<string, unknown>).estimated_duration_minutes =
            expectedMinutes;
        }
      }
    }
  }

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
  // Super admin gate for scope-charge button (mirrors requireStaff()).
  // Scope charges bypass the quote engine and bill the client directly,
  // so we keep the surface owner-only.
  const isSuperAdmin = isSuperAdminEmail(user?.email);
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
      .eq("status", "approved")
      .eq("payment_charged", false),
    db
      .from("extra_items")
      .select("fee_cents")
      .eq("job_id", move.id)
      .eq("job_type", "move")
      .eq("status", "approved")
      .eq("payment_charged", false),
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
        "slug, item_name, weight_score, category, room, is_common, display_order, active, num_people_min",
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
  const { data: pmLinkedPeer } = linkId
    ? await db
        .from("moves")
        .select("id, move_code, scheduled_date, client_name, status")
        .eq("id", linkId)
        .maybeSingle()
    : { data: null };

  // Event bookings split into delivery + return move rows sharing an
  // event_group_id (multi-event has several such pairs). Load the other leg(s)
  // so the move detail can show a linked two-leg panel with navigation.
  const eventGroupId = (move as { event_group_id?: string | null })
    .event_group_id;
  const { data: eventSiblings } = eventGroupId
    ? await db
        .from("moves")
        .select(
          "id, move_code, scheduled_date, client_name, status, event_phase, from_address, to_address",
        )
        .eq("event_group_id", eventGroupId)
        .neq("id", move.id)
        .order("scheduled_date", { ascending: true })
    : { data: null };

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

  // Resolve add-on details for display on the move page
  const rawMoveAddons = (move as { addons?: unknown }).addons;
  let resolvedAddons: { name: string; slug: string; qty?: number; price: number }[] = [];
  if (Array.isArray(rawMoveAddons) && rawMoveAddons.length > 0) {
    const addonIds = (rawMoveAddons as { addon_id?: string }[])
      .map((a) => a.addon_id)
      .filter(Boolean) as string[];
    if (addonIds.length > 0) {
      const { data: addonRows } = await db
        .from("addons")
        .select("id, name, slug, price, price_type, tiers, percent_value")
        .in("id", addonIds);

      const movePrice = Number((move as { custom_price?: unknown; total_price?: unknown }).custom_price ?? 0) || 0;

      for (const sel of rawMoveAddons as { addon_id?: string; slug?: string; quantity?: number; tier_index?: number }[]) {
        const rec = (addonRows ?? []).find((r) => r.id === sel.addon_id) as {
          id: string; name: string; slug: string;
          price: number; price_type: string;
          tiers: { price: number }[] | null;
          percent_value: number | null;
        } | null;
        if (!rec) continue;
        let linePrice = 0;
        switch (rec.price_type) {
          case "flat": linePrice = rec.price; break;
          case "per_unit": linePrice = rec.price * (sel.quantity || 1); break;
          case "tiered": linePrice = rec.tiers?.[sel.tier_index ?? 0]?.price ?? 0; break;
          case "percent": linePrice = Math.round(movePrice * (rec.percent_value ?? 0)); break;
        }
        resolvedAddons.push({
          name: rec.name,
          slug: rec.slug,
          qty: rec.price_type === "per_unit" ? (sel.quantity ?? 1) : undefined,
          price: linePrice,
        });
      }
    }
  }

  const mpResidentialId = (move as { move_project_id?: string | null }).move_project_id;
  let residentialMoveProject: {
    project: Record<string, unknown>;
    phases: { phase_name?: string | null; phase_type?: string | null; days?: Record<string, unknown>[] }[];
  } | null = null;
  if (typeof mpResidentialId === "string" && mpResidentialId.trim()) {
    const mpRes = await fetchMoveProjectWithTree(db, mpResidentialId.trim());
    if (!mpRes.error && mpRes.project && Array.isArray(mpRes.phases) && mpRes.phases.length > 0) {
      residentialMoveProject = {
        project: mpRes.project as Record<string, unknown>,
        phases: mpRes.phases as {
          phase_name?: string | null;
          phase_type?: string | null;
          days?: Record<string, unknown>[];
        }[],
      };
    }
  }

  // "New photos, please check" badge: any unread client-photo notification for
  // this move. Read it, then mark those notifications read so the badge is a
  // one-time signal cleared once the coordinator opens the move.
  const { data: photoNotif } = await db
    .from("in_app_notifications")
    .select("id, created_at")
    .eq("event_slug", "client_photos_uploaded")
    .eq("source_id", move.id)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const clientPhotosUpdate = photoNotif?.created_at
    ? String(photoNotif.created_at)
    : null;
  if (clientPhotosUpdate) {
    await db
      .from("in_app_notifications")
      .update({ is_read: true })
      .eq("event_slug", "client_photos_uploaded")
      .eq("source_id", move.id)
      .eq("is_read", false);
  }

  return (
    <MoveDetailClient
      move={move}
      clientPhotosUpdate={clientPhotosUpdate}
      pmLinkedPeer={pmLinkedPeer}
      eventSiblings={eventSiblings ?? []}
      crews={crews ?? []}
      isOffice={isOffice}
      userRole={userRole}
      isSuperAdmin={isSuperAdmin}
      resolvedAddons={resolvedAddons}
      additionalOrigins={linkedAdditionalOrigins ?? []}
      additionalDestinations={linkedAdditionalDestinations ?? []}
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
      residentialMoveProject={residentialMoveProject}
    />
  );
}
