export const dynamic = "force-dynamic";

import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import ClaimDetailClient from "./ClaimDetailClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: claim } = await db.from("claims").select("claim_number").eq("id", id).single();
  const name = claim?.claim_number ? `Claim ${claim.claim_number}` : "Claim";
  return { title: name };
}

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();

  const [{ data: claim }, { data: photos }, { data: timeline }] = await Promise.all([
    db.from("claims").select("*").eq("id", id).single(),
    db.from("claim_photos").select("*").eq("claim_id", id).order("created_at", { ascending: true }),
    db.from("claim_timeline").select("*").eq("claim_id", id).order("created_at", { ascending: true }),
  ]);

  if (!claim) notFound();

  let moveCode: string | null = null;
  let moveTier: string | null = null;
  let crewName: string | null = null;
  let crewMembersNames: string[] = [];

  if (claim.move_id) {
    const { data: move } = await db
      .from("moves")
      .select("move_code, tier_selected, crew_id")
      .eq("id", claim.move_id)
      .maybeSingle();
    if (move) {
      moveCode = move.move_code;
      moveTier = move.tier_selected;
      if (move.crew_id) {
        const { data: crew } = await db.from("crews").select("name, members").eq("id", move.crew_id).maybeSingle();
        if (crew) {
          crewName = crew.name;
          crewMembersNames = crew.members || [];
        }
      }
    }
  }

  return (
    <ClaimDetailClient
      claim={claim}
      photos={photos || []}
      timeline={timeline || []}
      moveCode={moveCode}
      moveTier={moveTier}
      crewName={crewName}
      crewMembers={crewMembersNames}
    />
  );
}
