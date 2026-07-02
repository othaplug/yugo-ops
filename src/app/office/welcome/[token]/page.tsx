import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPublicMoveTrackUrl } from "@/lib/notifications/public-track-url";
import { getClientSupportEmail } from "@/lib/email/client-support-email";
import { formatMoveDate } from "@/lib/date-format";
import OfficeWelcomeGuideView from "../OfficeWelcomeGuideView";
import { fetchMoveProjectWithTree } from "@/lib/move-projects/fetch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your Priority office relocation guide",
  robots: { index: false, follow: false },
};

export default async function OfficeWelcomePage({
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
      "id, move_code, status, tier_selected, client_name, scheduled_date, coordinator_name, coordinator_phone, coordinator_email, from_address, to_address, welcome_package_token, move_project_id, quote_id, service_type",
    )
    .eq("welcome_package_token", raw)
    .maybeSingle();

  if (error || !move) notFound();

  const tier = String(move.tier_selected || "")
    .toLowerCase()
    .trim();
  const svc = String(move.service_type || "").toLowerCase().trim();
  // Gate: only office_move Priority. Estate is served by /estate/welcome.
  if (tier !== "priority" || svc !== "office_move") notFound();

  const st = String(move.status || "").toLowerCase();
  if (st === "cancelled") notFound();

  // Pull PM + company + officeDayCount from the linked quote's factors
  // (source of truth for office-specific scalars — see
  // project_event_architecture memory).
  let projectManagerName: string | null = null;
  let projectManagerPhone: string | null = null;
  let companyName: string | null = null;
  let officeDayCount: number | null = null;
  const quoteId = (move as { quote_id?: string | null }).quote_id;
  if (quoteId) {
    const { data: quote } = await supabase
      .from("quotes")
      .select("factors_applied")
      .eq("id", quoteId)
      .maybeSingle();
    const factors = (quote?.factors_applied ?? {}) as Record<string, unknown>;
    const pmn = factors.project_manager_name;
    const pmp = factors.project_manager_phone;
    const co = factors.company_name;
    if (typeof pmn === "string" && pmn.trim()) projectManagerName = pmn.trim();
    if (typeof pmp === "string" && pmp.trim()) projectManagerPhone = pmp.trim();
    if (typeof co === "string" && co.trim()) companyName = co.trim();
    const perTier = factors.office_per_tier_days as
      | Record<string, number>
      | undefined;
    const n = perTier?.priority;
    if (typeof n === "number" && n > 0) officeDayCount = n;
  }
  // PM defaults to the coordinator until a distinct PM is captured
  // (post-book crew assignment can override). Phone always falls back to
  // the shared office line so the client never sees a blank contact row.
  if (!projectManagerName) {
    projectManagerName = move.coordinator_name?.trim() || null;
  }
  if (!projectManagerPhone) {
    projectManagerPhone = "(647) 370-4525";
  }

  const trackUrl = buildPublicMoveTrackUrl({
    id: move.id,
    move_code: move.move_code ?? null,
  });

  // Multi-day range for the hero subline. When officeDayCount > 1, show
  // "Sat, Jul 11 – Sun, Jul 12" instead of just the start date so the
  // welcome guide matches the confirmation email date-range treatment.
  const moveDateLabel: string | null = (() => {
    if (!move.scheduled_date) return null;
    const start = formatMoveDate(move.scheduled_date);
    if (!officeDayCount || officeDayCount <= 1) return start;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(move.scheduled_date);
    if (!m) return start;
    const end = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]) + (officeDayCount - 1),
    );
    const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;
    return `${start} – ${formatMoveDate(endIso)}`;
  })();

  let moveProjectSchedule: {
    totalDays: number;
    days: { date: string; label: string; description?: string | null }[];
  } | null = null;
  const mpId = (move as { move_project_id?: string | null }).move_project_id;
  if (mpId) {
    const mpRes = await fetchMoveProjectWithTree(supabase, mpId);
    const td = mpRes.project
      ? Number((mpRes.project as { total_days?: number }).total_days)
      : 0;
    if (!mpRes.error && mpRes.project && td > 2) {
      const flat = (mpRes.phases ?? [])
        .flatMap((ph) =>
          (Array.isArray(ph.days) ? ph.days : []) as {
            date?: string;
            label?: string;
            description?: string | null;
          }[],
        )
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
    <OfficeWelcomeGuideView
      moveCode={move.move_code ?? move.id}
      moveDateLabel={moveDateLabel}
      trackUrl={trackUrl}
      coordName={move.coordinator_name?.trim() || null}
      coordPhone={move.coordinator_phone?.trim() || null}
      coordEmail={move.coordinator_email?.trim() || null}
      projectManagerName={projectManagerName}
      projectManagerPhone={projectManagerPhone}
      supportEmail={getClientSupportEmail()}
      clientName={move.client_name?.trim() || null}
      companyName={companyName}
      hasScheduledMove={Boolean(move.scheduled_date)}
      moveProjectSchedule={moveProjectSchedule}
    />
  );
}
