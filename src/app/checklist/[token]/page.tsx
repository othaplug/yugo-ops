import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import ChecklistClient from "./ChecklistClient";
import {
  accessMentionsElevator,
  parkingReminderLikelyNeeded,
} from "@/lib/moves/pre-move-heuristics";

export const dynamic = "force-dynamic";

export default async function ChecklistTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = String(token || "").trim();
  if (!t) notFound();

  const sb = createAdminClient();
  // NOTE: do NOT select `service_tier` — that column does not exist on `moves`.
  // Including it made the whole query error → `move` came back null → the page
  // 404'd for every client even though the checklist_token was valid. `moves`
  // uses `tier_selected` for the package tier.
  const { data: move, error: moveErr } = await sb
    .from("moves")
    .select(
      "id, client_name, from_access, to_access, from_postal, to_postal, from_parking, to_parking, tier_selected, extended_checklist_progress",
    )
    .eq("checklist_token", t)
    .maybeSingle();

  if (moveErr) {
    console.error("[checklist] move lookup failed:", moveErr.message);
  }
  if (!move) notFound();

  const tierLower = String(move.tier_selected || "signature")
    .toLowerCase()
    .trim();

  return (
    <ChecklistClient
      token={t}
      clientName={move.client_name || ""}
      initialChecked={(move.extended_checklist_progress as Record<string, boolean>) || {}}
      hasElevatorHint={accessMentionsElevator(move.from_access, move.to_access)}
      parkingLikely={parkingReminderLikelyNeeded(move)}
      tierLower={tierLower}
    />
  );
}
