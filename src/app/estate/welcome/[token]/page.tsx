import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPublicMoveTrackUrl } from "@/lib/notifications/public-track-url";
import { getClientSupportEmail } from "@/lib/email/client-support-email";
import { formatMoveDate } from "@/lib/date-format";
import EstateWelcomeGuideView from "../EstateWelcomeGuideView";
import { fetchMoveProjectWithTree } from "@/lib/move-projects/fetch";

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
      "id, move_code, status, tier_selected, service_tier, client_name, scheduled_date, coordinator_name, coordinator_phone, coordinator_email, from_address, to_address, welcome_package_token, move_project_id",
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

  const trackUrl = buildPublicMoveTrackUrl({
    id: move.id,
    move_code: move.move_code ?? null,
  });

  const moveDateLabel = move.scheduled_date
    ? formatMoveDate(move.scheduled_date)
    : null;

  let moveProjectSchedule: {
    totalDays: number;
    days: { date: string; label: string; description?: string | null }[];
  } | null = null;
  const mpId = (move as { move_project_id?: string | null }).move_project_id;
  if (mpId) {
    const mpRes = await fetchMoveProjectWithTree(supabase, mpId);
    const td = mpRes.project ? Number((mpRes.project as { total_days?: number }).total_days) : 0;
    if (!mpRes.error && mpRes.project && td > 2) {
      const flat = (mpRes.phases ?? [])
        .flatMap((ph) => (Array.isArray(ph.days) ? ph.days : []) as { date?: string; label?: string; description?: string | null }[])
        .filter((d) => d.date)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)));
      moveProjectSchedule = {
        totalDays: td,
        days: flat.map((d) => ({
          date: String(d.date),
          label: String(d.label || "Day"),
          description: d.description ?? null,
        })),
      };
    }
  }

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
      moveProjectSchedule={moveProjectSchedule}
    />
  );
}
