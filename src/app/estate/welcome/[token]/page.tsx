import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getClientSupportEmail } from "@/lib/email/client-support-email";
import { formatMoveDate } from "@/lib/date-format";
import EstateWelcomeGuideView from "../EstateWelcomeGuideView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Estate welcome guide",
  robots: { index: false, follow: false },
};

export default async function EstateWelcomePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const raw = (await params).token?.trim() || "";
  if (!raw || raw.length > 200) notFound();

  const supabase = createAdminClient();
  const { data: move, error } = await supabase
    .from("moves")
    .select(
      "id, move_code, status, tier_selected, service_tier, client_name, scheduled_date, coordinator_name, coordinator_phone, coordinator_email, from_address, to_address, welcome_package_token",
    )
    .eq("welcome_package_token", raw)
    .maybeSingle();

  if (error || !move) notFound();

  const tier = String(move.tier_selected || move.service_tier || "")
    .toLowerCase()
    .trim();
  if (tier !== "estate") notFound();

  const st = String(move.status || "").toLowerCase();
  if (st === "cancelled") notFound();

  const baseUrl = getEmailBaseUrl();
  const trackUrl = `${baseUrl}/track/move/${move.move_code ?? move.id}?token=${signTrackToken("move", move.id)}`;

  const moveDateLabel = move.scheduled_date
    ? formatMoveDate(move.scheduled_date)
    : null;

  return (
    <EstateWelcomeGuideView
      moveCode={move.move_code ?? move.id}
      moveDateLabel={moveDateLabel}
      trackUrl={trackUrl}
      coordName={move.coordinator_name?.trim() || null}
      coordPhone={move.coordinator_phone?.trim() || null}
      coordEmail={move.coordinator_email?.trim() || null}
      supportEmail={getClientSupportEmail()}
      clientName={move.client_name?.trim() || null}
      hasScheduledMove={Boolean(move.scheduled_date)}
    />
  );
}
