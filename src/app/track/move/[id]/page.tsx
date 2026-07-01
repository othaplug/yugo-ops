import { notFound } from "next/navigation";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { getLegalBranding } from "@/lib/legal-branding";
import { verifyTrackToken } from "@/lib/track-token";
import { isMoveIdUuid } from "@/lib/move-code";
import { isFeatureEnabled, getFeatureConfig } from "@/lib/platform-settings";
import { parseDateOnly } from "@/lib/date-format";
import TrackMoveClient from "./TrackMoveClient";
import { fetchMoveProjectWithTree } from "@/lib/move-projects/fetch";
import { pickupLocationsFromQuote, abbreviateLocationRows } from "@/lib/quotes/quote-address-display";

export const metadata: Metadata = {
  title: "Track Your Move",
  robots: "noindex, nofollow",
};
export const dynamic = "force-dynamic";

export default async function TrackMovePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; from?: string; payment?: string }>;
}) {
  const slug = decodeURIComponent((await params).id?.trim() || "");
  const { token, from, payment } = await searchParams;
  const supabase = createAdminClient();

  const byUuid = isMoveIdUuid(slug);
  const { data: move, error } = byUuid
    ? await supabase.from("moves").select("*").eq("id", slug).single()
    : await supabase.from("moves").select("*").ilike("move_code", slug.replace(/^#/, "").toUpperCase()).single();

  if (error || !move) notFound();
  if (!verifyTrackToken("move", move.id, token || "")) notFound();

  // Tracking pages never expire, completed moves show the permanent perks hub.
  // Clients bookmarking this URL years later still see their perks + referral code.
  const linkExpired = false;

  // Crew object passed to the client tree. Two scrubs happen here so
  // no downstream component (TrackMoveClient, TrackLiveMap, the map
  // popups in Mapbox/Leaflet) ever sees the internal team identifier
  // ("Alpha", "Bravo", "Team B"):
  //
  //   1. crew.name is replaced with a friendly mover-names list built
  //      from move.assigned_members ("John & Gary"), or a neutral
  //      "Your moving crew" when names aren't on the row yet.
  //   2. move.assigned_crew_name (which crew-job-snapshot.ts also
  //      writes from crews.name) is overwritten on the move object
  //      with the same scrubbed value, because TrackMoveClient reads
  //      assigned_crew_name FIRST and falls back to crew.name only as
  //      a tiebreaker. Both fields now agree on the safe value.
  //
  // The crew id is preserved so the live tracking subscription
  // (crew_locations realtime channel) still works.
  function clientFacingCrewName(assigned: unknown): string {
    const names = Array.isArray(assigned)
      ? (assigned as unknown[])
          .map((n) => String(n ?? "").trim())
          .filter(Boolean)
      : [];
    if (names.length === 0) return "Your moving crew";
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} & ${names[1]}`;
    return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
  }

  const clientCrewLabel = clientFacingCrewName(move.assigned_members);

  let crew: { id: string; name: string; members?: string[] } | null = null;
  if (move.crew_id) {
    const { data: c } = await supabase
      .from("crews")
      .select("id, members")
      .eq("id", move.crew_id)
      .single();
    if (c) {
      crew = {
        id: c.id,
        // NEVER c.name, that's the internal team identifier.
        name: clientCrewLabel,
        members: Array.isArray(c.members) ? c.members : undefined,
      };
    }
  }

  // Same scrub on the move row's assigned_crew_name before it gets
  // serialised down to the client component.
  if (move && typeof move === "object") {
    (move as { assigned_crew_name?: string | null }).assigned_crew_name =
      clientCrewLabel === "Your moving crew" ? null : clientCrewLabel;
  }

  // Approved fees from change requests and extra items (for client balance)
  const { data: approvedChanges } = await supabase
    .from("move_change_requests")
    .select("fee_cents")
    .eq("move_id", move.id)
    .eq("status", "approved")
    .eq("payment_charged", false);
  const { data: approvedExtras } = await supabase
    .from("extra_items")
    .select("fee_cents")
    .eq("job_id", move.id)
    .eq("job_type", "move")
    .eq("status", "approved")
    .eq("payment_charged", false);
  const changeFeesCents = (approvedChanges ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0);
  const extraFeesCents = (approvedExtras ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0);
  const additionalFeesCents = changeFeesCents + extraFeesCents;
  const tippingEnabled = await isFeatureEnabled("tipping_enabled");

  // Server-side show-once tip prompt logic:
  // Mark tip_prompt_shown_at on the very first completed-page load,
  // BEFORE we respond to the client, so every subsequent visit gets false.
  let showTipPrompt = false;
  let tipData: { amount: number } | null = null;

  if (tippingEnabled && move.status === "completed") {
    // Fetch existing tip record
    const { data: existingTip } = await supabase
      .from("tips")
      .select("amount, charged_at")
      .eq("move_id", move.id)
      .maybeSingle();

    if (existingTip?.charged_at) {
      tipData = { amount: Number(existingTip.amount) };
    } else if (!move.tip_prompt_shown_at && move.square_card_id) {
      // First visit after completion with a card on file, show the full prompt
      await supabase
        .from("moves")
        .update({ tip_prompt_shown_at: new Date().toISOString() })
        .eq("id", move.id);
      showTipPrompt = true;
    }
  }

  // Crew size for per-mover tip amounts
  const crewMembersArr: string[] = Array.isArray(move.assigned_members)
    ? move.assigned_members
    : Array.isArray(crew?.members)
    ? (crew?.members ?? [])
    : [];
  const crewSize = Math.max(2, crewMembersArr.length);

  const { data: binOrder } = await supabase
    .from("bin_orders")
    .select("*")
    .eq("move_id", move.id)
    .maybeSingle();

  // Supplies a client can self-purchase from the track page (reuses the
  // residential supply add-ons). Only shown before the move, paid one-tap on
  // the card on file (or a new card), delivered with the crew on move day.
  const SUPPLY_SLUGS = [
    "packing_materials",
    "wardrobe_boxes",
    "mattress_bag",
    "picture_crating",
  ];
  const { data: suppliesRows } = await supabase
    .from("addons")
    .select("slug, name, description, price, price_type, unit_label, display_order")
    .in("slug", SUPPLY_SLUGS)
    .eq("active", true)
    .order("display_order", { ascending: true });
  const suppliesCatalog = (suppliesRows ?? []).map((a) => ({
    slug: a.slug as string,
    name: a.name as string,
    description: (a.description as string) ?? null,
    price: Number(a.price) || 0,
    price_type: a.price_type as string,
    unit_label: (a.unit_label as string) ?? null,
  }));
  const moveStatusLc = String(move.status || "").toLowerCase();
  const suppliesEligible = !["completed", "cancelled", "canceled"].includes(
    moveStatusLc,
  );
  const hasCardOnFile = Boolean(move.square_card_id || move.square_customer_id);
  const squareUseSandbox =
    (process.env.SQUARE_ENVIRONMENT || "").toLowerCase() === "sandbox" ||
    (process.env.NEXT_PUBLIC_SQUARE_USE_SANDBOX || "").toLowerCase() === "true";

  const icCfg = await getFeatureConfig([
    "change_request_enabled",
    "change_request_per_score_rate",
    "change_request_min_hours_before_move",
    "change_request_max_items_per_request",
  ]);
  const [{ data: itemWeights }, { data: pendingIcRows }, { data: latestInvAdj }, { data: crewPendingRows }] = await Promise.all([
    supabase.from("item_weights").select("slug, item_name, weight_score, active, num_people_min").eq("active", true).limit(2000),
    supabase
      .from("inventory_change_requests")
      .select("id, status, submitted_at, source")
      .eq("move_id", move.id)
      .in("status", ["pending", "admin_reviewing", "client_confirming"])
      .eq("source", "client")
      .order("submitted_at", { ascending: false })
      .limit(1),
    supabase
      .from("inventory_change_requests")
      .select("id, additional_deposit_required, reviewed_at, status")
      .eq("move_id", move.id)
      .in("status", ["approved", "adjusted"])
      .gt("additional_deposit_required", 0)
      .order("reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    // Crew-submitted pending change requests (move-day walkthrough)
    supabase
      .from("inventory_change_requests")
      .select("id, status, submitted_at, source, auto_calculated_delta, items_added, items_removed, items_matched, items_missing, items_extra, original_subtotal, new_subtotal, client_response")
      .eq("move_id", move.id)
      .eq("source", "crew")
      .in("status", ["pending", "admin_reviewing"])
      .is("client_response", null)
      .order("submitted_at", { ascending: false })
      .limit(1),
  ]);

  const pendingInventoryCr = pendingIcRows?.[0] ?? null;
  const crewChangeRequest = crewPendingRows?.[0] ?? null;

  const { data: pendingBookingMod } = await supabase
    .from("move_modifications")
    .select("id, type, new_price, original_price, price_difference, created_at")
    .eq("move_id", move.id)
    .eq("status", "pending_approval")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let quotePickupStops: { address: string; access: string | null }[] | null = null;
  // White Glove sub-type (delivery vs service) lives on the originating quote's
  // factors_applied (not copied to the move row); surface it so the track page
  // can tailor copy. Defaults to "delivery" for legacy/unknown.
  let whiteGloveKind: "delivery" | "service" = "delivery";
  if (move.quote_id) {
    const { data: originQuote } = await supabase
      .from("quotes")
      .select("factors_applied, from_address, from_access")
      .eq("id", move.quote_id)
      .maybeSingle();
    if (originQuote) {
      const fac = originQuote.factors_applied as Record<string, unknown> | null;
      if (fac?.white_glove_kind === "service") whiteGloveKind = "service";
      const rows = abbreviateLocationRows(
        pickupLocationsFromQuote(fac, originQuote.from_address, originQuote.from_access),
      );
      if (rows.length > 1) quotePickupStops = rows;
    }
  }

  const st = String(move.status || "").toLowerCase();
  // minH=0 means no time restriction (migration sets this to 0)
  const minH = parseInt(icCfg.change_request_min_hours_before_move, 10);
  const moveDate = move.scheduled_date ? parseDateOnly(move.scheduled_date) ?? new Date(move.scheduled_date) : null;
  // When minH <= 0, no time restriction applies
  const hoursOk = minH <= 0 || !moveDate || (moveDate.getTime() - Date.now() >= minH * 3600_000);
  const statusOk = ["confirmed", "scheduled", "paid"].includes(st);
  const notTerminal = !["in_progress", "completed", "delivered", "cancelled"].includes(st);
  const invChangeEnabled = icCfg.change_request_enabled === "true";
  const noPending = !pendingInventoryCr && !move.pending_inventory_change_request_id;
  const inventoryChangeEligible =
    invChangeEnabled && statusOk && notTerminal && noPending && hoursOk;
  let inventoryChangeReason = "";
  if (!invChangeEnabled) inventoryChangeReason = "Inventory change requests are turned off.";
  else if (!statusOk || !notTerminal) inventoryChangeReason = "Not available for this move status.";
  else if (!hoursOk) inventoryChangeReason = `Changes must be submitted before move day.`;
  else if (!noPending) inventoryChangeReason = "You already have a pending inventory change request.";

  const { email: companyContactEmail } = await getLegalBranding();

  // Coordinator displayed on the client track page. Source of truth:
  //   1. moves.coordinator_name (per-move override, set on quote/move create)
  //   2. platform_config.coordinator_name (org default)
  //   3. fallback: null → client UI shows Yugo logo
  //
  // Defensive guard: getFeatureConfig used to fall back to the literal
  // string "false" for any key not in FEATURE_DEFAULTS (now fixed to
  // empty string). We still strip literal "false" / "true" here so a
  // legacy platform_config row with one of those values doesn't render
  // as the coordinator's name on the client tracking page.
  const isNameValue = (v: string | null | undefined): string | null => {
    const t = (v ?? "").trim();
    if (!t) return null;
    if (t.toLowerCase() === "false" || t.toLowerCase() === "true") return null;
    return t;
  };
  const coordinatorCfg = await getFeatureConfig(["coordinator_name", "coordinator_phone"]);
  const trackCoordinatorName: string | null =
    isNameValue(
      (move as { coordinator_name?: string | null }).coordinator_name,
    ) ?? isNameValue(coordinatorCfg.coordinator_name);
  const trackCoordinatorPhone: string | null =
    isNameValue(
      (move as { coordinator_phone?: string | null }).coordinator_phone,
    ) ?? isNameValue(coordinatorCfg.coordinator_phone);

  let moveProjectForTrack: {
    project: Record<string, unknown>;
    phases: {
      phase_name?: string;
      days?: {
        date?: string;
        label?: string;
        status?: string;
        day_number?: number;
        day_type?: string;
        current_stage?: string | null;
      }[];
    }[];
  } | null = null;
  const mpTrackId = (move as { move_project_id?: string | null }).move_project_id;
  if (mpTrackId) {
    const mpRes = await fetchMoveProjectWithTree(supabase, mpTrackId);
    const phaseTree = mpRes.phases ?? [];
    if (!mpRes.error && mpRes.project && phaseTree.length > 0) {
      moveProjectForTrack = {
        project: mpRes.project as Record<string, unknown>,
        phases: phaseTree as {
          phase_name?: string;
          days?: { date?: string; label?: string; status?: string }[];
        }[],
      };
    }
  }

  // Office move: pull day count and truck count from the originating
  // quote's factors so the office track hero can render the phased
  // Day 1 / Day 2 view and the "N × 16ft Box Truck" fleet label.
  let officeDayCount: number | null = null;
  let officeTruckCount: number | null = null;
  let officeProjectManagerName: string | null = null;
  let officeProjectManagerPhone: string | null = null;
  if ((move as { service_type?: string }).service_type === "office_move") {
    const quoteIdForTrack = (move as { quote_id?: string | null }).quote_id;
    if (quoteIdForTrack) {
      const { data: qRow } = await supabase
        .from("quotes")
        .select("factors_applied, recommended_tier, selected_tier")
        .eq("id", quoteIdForTrack)
        .maybeSingle();
      const factors = (qRow?.factors_applied ?? {}) as Record<string, unknown>;
      const perTier = factors.office_per_tier_days as
        | Record<string, number>
        | undefined;
      const tk = (
        (qRow?.selected_tier as string | null) ??
        (qRow?.recommended_tier as string | null) ??
        "priority"
      ).toLowerCase();
      const days = perTier?.[tk];
      officeDayCount = typeof days === "number" && days > 0 ? days : null;
      const trucks = factors.office_trucks;
      officeTruckCount =
        typeof trucks === "number" && trucks > 0 ? trucks : null;
      const pmName = factors.project_manager_name;
      officeProjectManagerName =
        typeof pmName === "string" && pmName.trim() ? pmName.trim() : null;
      const pmPhone = factors.project_manager_phone;
      officeProjectManagerPhone =
        typeof pmPhone === "string" && pmPhone.trim() ? pmPhone.trim() : null;
    }
  }

  return (
    <TrackMoveClient
      move={move}
      companyContactEmail={companyContactEmail}
      crew={crew}
      token={token || ""}
      fromNotify={from === "notify"}
      paymentSuccess={payment === "success"}
      linkExpired={linkExpired}
      officeDayCount={officeDayCount}
      officeTruckCount={officeTruckCount}
      officeProjectManagerName={officeProjectManagerName}
      officeProjectManagerPhone={officeProjectManagerPhone}
      additionalFeesCents={additionalFeesCents}
      changeRequestFeesCents={changeFeesCents}
      extraItemFeesCents={extraFeesCents}
      tippingEnabled={tippingEnabled}
      showTipPrompt={showTipPrompt}
      tipData={tipData}
      crewSize={crewSize}
      inventoryChangeFeatureOn={invChangeEnabled}
      inventoryChangeItemWeights={itemWeights ?? []}
      inventoryChangeEligible={inventoryChangeEligible}
      inventoryChangeReason={inventoryChangeReason}
      inventoryChangePending={pendingInventoryCr}
      inventoryChangePerScoreRate={parseFloat(icCfg.change_request_per_score_rate) || 35}
      inventoryChangeMaxItems={Math.max(1, parseInt(icCfg.change_request_max_items_per_request, 10) || 10)}
      latestInventoryAdjustmentPayment={latestInvAdj ?? null}
      crewChangeRequest={crewChangeRequest as {
        id: string;
        status: string;
        submitted_at: string;
        auto_calculated_delta: number;
        items_added: unknown[];
        items_removed: unknown[];
        items_matched: number;
        items_missing: number;
        items_extra: number;
        original_subtotal: number;
        new_subtotal: number;
        client_response: string | null;
      } | null}
      binOrder={binOrder}
      quotePickupStops={quotePickupStops}
      whiteGloveKind={whiteGloveKind}
      pendingBookingModification={pendingBookingMod ?? null}
      moveProjectForTrack={moveProjectForTrack}
      coordinatorName={trackCoordinatorName}
      coordinatorPhone={trackCoordinatorPhone}
      suppliesCatalog={suppliesEligible ? suppliesCatalog : []}
      suppliesHasCardOnFile={hasCardOnFile}
      suppliesUseSandbox={squareUseSandbox}
    />
  );
}
