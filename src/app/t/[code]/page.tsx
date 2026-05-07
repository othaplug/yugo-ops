import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";

/**
 * Short tracking redirect — sent in SMS to keep links clean.
 * /t/MV-30210  →  /track/move/MV-30210?token=...
 * /t/DEL-1001  →  /track/delivery/DEL-1001?token=...
 */
export const dynamic = "force-dynamic";

export default async function ShortTrackRedirect({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const slug = decodeURIComponent(code || "").toUpperCase().trim();
  if (!slug) notFound();

  const db = createAdminClient();
  const base = getEmailBaseUrl().replace(/\/$/, "");

  // Try moves first (MV- prefix)
  const { data: move } = await db
    .from("moves")
    .select("id, move_code")
    .ilike("move_code", slug)
    .maybeSingle();

  if (move?.id) {
    const token = signTrackToken("move", move.id);
    redirect(`${base}/track/move/${encodeURIComponent(move.move_code ?? slug)}?token=${token}`);
  }

  // Try deliveries
  const { data: delivery } = await db
    .from("deliveries")
    .select("id, delivery_number")
    .ilike("delivery_number", slug)
    .maybeSingle();

  if (delivery?.id) {
    const token = signTrackToken("delivery", delivery.id);
    redirect(`${base}/track/delivery/${encodeURIComponent(delivery.delivery_number ?? slug)}?token=${token}`);
  }

  notFound();
}
