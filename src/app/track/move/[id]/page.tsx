import { notFound } from "next/navigation";
import { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isMoveIdUuid } from "@/lib/move-code";
import { isFeatureEnabled } from "@/lib/platform-settings";
import TrackMoveClient from "./TrackMoveClient";

export const metadata: Metadata = {
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

  return (
    <TrackMoveClient
      move={move}
      crew={crew}
      token={token || ""}
      fromNotify={from === "notify"}
      paymentSuccess={payment === "success"}
      linkExpired={linkExpired}
      additionalFeesCents={additionalFeesCents}
      changeRequestFeesCents={changeFeesCents}
      extraItemFeesCents={extraFeesCents}
      tippingEnabled={tippingEnabled}
    />
  );
}
