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
  // NOTE: select ONLY columns that exist on `moves`. Including a non-existent
  // column (previously `service_tier`, then `from_postal`/`to_postal`) makes the
  // whole query error → `move` comes back null → the page 404s for every client
  // even though the checklist_token is valid. `moves` has no separate postal
  // columns, so the parking heuristic runs on parking text only.
  const { data: move, error: moveErr } = await sb
    .from("moves")
    .select(
      "id, client_name, from_access, to_access, from_parking, to_parking, tier_selected, extended_checklist_progress",
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
