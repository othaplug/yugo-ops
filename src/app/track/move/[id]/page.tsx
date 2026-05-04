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

  // Tracking pages never expire — completed moves show the permanent perks hub.
  // Clients bookmarking this URL years later still see their perks + referral code.
  const linkExpired = false;

  let crew: { id: string; name: string; members?: string[] } | null = null;
  if (move.crew_id) {
    const { data: c } = await supabase
      .from("crews")
      .select("id, name, members")
      .eq("id", move.crew_id)
      .single();
    crew = c;
  }

  // Approved fees from change requests and extra items (for client balance)
  const { data: approvedChanges } = await supabase
    .from("move_change_requests")
    .select("fee_cents")
    .eq("move_id", move.id)
    .eq("status", "approved");
  const { data: approvedExtras } = await supabase
    .from("extra_items")
    .select("fee_cents")
    .eq("job_id", move.id)
    .eq("job_type", "move")
    .eq("status", "approved");
  const changeFeesCents = (approvedChanges ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0);
  const extraFeesCents = (approvedExtras ?? []).reduce((s, r) => s + (Number(r.fee_cents) || 0), 0);
  const additionalFeesCents = changeFeesCents + extraFeesCents;
  const tippingEnabled = await isFeatureEnabled("tipping_enabled");

  // Server-side show-once tip prompt logic:
  // Mark tip_prompt_shown_at on the very first completed-page load,
  // BEFORE we respond to the client — so every subsequent visit gets false.
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
      // First visit after completion with a card on file — show the full prompt
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
  if (move.quote_id) {
    const { data: originQuote } = await supabase
      .from("quotes")
      .select("factors_applied, from_address, from_access")
      .eq("id", move.quote_id)
      .maybeSingle();
    if (originQuote) {
      const fac = originQuote.factors_applied as Record<string, unknown> | null;
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

  return (
    <TrackMoveClient
      move={move}
      companyContactEmail={companyContactEmail}
      crew={crew}
      token={token || ""}
      fromNotify={from === "notify"}
      paymentSuccess={payment === "success"}
      linkExpired={linkExpired}
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
      pendingBookingModification={pendingBookingMod ?? null}
      moveProjectForTrack={moveProjectForTrack}
    />
  );
}
