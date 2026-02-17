import { notFound } from "next/navigation";
import { Metadata } from "next";
import { getMoveCode } from "@/lib/move-code";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import TrackMoveClient from "./TrackMoveClient";

export const metadata: Metadata = {
  robots: "noindex, nofollow",
};

export default async function TrackMovePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string; from?: string; payment?: string }>;
}) {
  const { id } = await params;
  const { token, from, payment } = await searchParams;

  if (!verifyTrackToken("move", id, token || "")) notFound();

  const supabase = createAdminClient();
  const { data: move, error } = await supabase
    .from("moves")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !move) notFound();

  let crew: { id: string; name: string; members?: string[] } | null = null;
  if (move.crew_id) {
    const { data: c } = await supabase
      .from("crews")
      .select("id, name, members")
      .eq("id", move.crew_id)
      .single();
    crew = c;
  }

  return (
    <TrackMoveClient
      move={move}
      crew={crew}
      token={token || ""}
      fromNotify={from === "notify"}
      paymentSuccess={payment === "success"}
    />
  );
}
