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
  const { data: move } = await sb
    .from("moves")
    .select(
      "id, client_name, from_access, to_access, from_postal, to_postal, from_parking, to_parking, tier_selected, service_tier, extended_checklist_progress",
    )
    .eq("checklist_token", t)
    .maybeSingle();

  if (!move) notFound();

  const tierLower = String(move.tier_selected || move.service_tier || "signature")
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
