import { SupabaseClient } from "@supabase/supabase-js";

export async function createReviewRequestIfEligible(
  supabase: SupabaseClient,
  moveId: string
): Promise<boolean> {
  const { data: config } = await supabase
    .from("platform_config")
    .select("value")
    .eq("key", "auto_review_requests")
    .single();
  if (config?.value !== "true" && config?.value !== "1") return false;

  const { data: move } = await supabase
    .from("moves")
    .select("id, client_name, client_email, client_phone, tier_selected, status, completed_at")
    .eq("id", moveId)
    .single();
  if (!move || move.status !== "completed") return false;

  const completedAt = move.completed_at ? new Date(move.completed_at) : new Date();
  const sendAt = new Date(completedAt.getTime() + 2 * 60 * 60 * 1000);
  const reminderAt = new Date(completedAt.getTime() + 3 * 24 * 60 * 60 * 1000);

  const { data: claim } = await supabase
    .from("claims")
    .select("id")
    .eq("move_id", moveId)
    .limit(1)
    .maybeSingle();
  if (claim) return false;

  let podRating: number | null = null;
  const { data: pod } = await supabase
    .from("proof_of_delivery")
    .select("satisfaction_rating")
    .eq("move_id", moveId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pod?.satisfaction_rating != null) {
    podRating = Number(pod.satisfaction_rating);
    if (podRating >= 1 && podRating <= 3) return false;
  }

  const { data: existing } = await supabase
    .from("review_requests")
    .select("id")
    .eq("move_id", moveId)
    .maybeSingle();
  if (existing) return false;

  if (!move.client_email && !move.client_phone) return false;

  const { error } = await supabase.from("review_requests").insert({
    move_id: moveId,
    client_name: move.client_name || "Client",
    client_email: move.client_email || null,
    client_phone: move.client_phone || null,
    tier: move.tier_selected || null,
    pod_rating: podRating,
    scheduled_send_at: sendAt.toISOString(),
    reminder_send_at: reminderAt.toISOString(),
    status: "pending",
  });

  return !error;
}
