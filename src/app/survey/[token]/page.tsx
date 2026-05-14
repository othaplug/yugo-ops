import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import SurveyClient from "./SurveyClient";
import PhotoSurveyClient from "./PhotoSurveyClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Room photos" };

/**
 * Photo survey landing page.
 *
 * Two flows send a /survey/[token] link to clients, and they store the token
 * in different places — this page resolves both:
 *
 * 1. Post-payment "Help us prepare" email (src/lib/automations/post-payment.ts)
 *    → token lives in `moves.survey_token`
 *    → API at /api/survey/[token]
 *    → renders SurveyClient (older, simpler, room buckets)
 *
 * 2. Admin lead photo request (src/app/api/admin/leads/[id]/photo-request)
 *    → token lives in `photo_surveys.token` (and leads.photo_survey_token)
 *    → API at /api/surveys/[token]
 *    → renders PhotoSurveyClient (newer, move-size-aware)
 *
 * The previous version of this file only checked photo_surveys, so every
 * emailed link from the post-payment automation 404'd. We now try moves
 * first (the more common flow), then fall back to photo_surveys.
 */
export default async function PhotoSurveyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 8) notFound();

  const sb = createAdminClient();

  // 1) Post-payment move survey
  const { data: move } = await sb
    .from("moves")
    .select("id, move_code, client_name, survey_completed")
    .eq("survey_token", token)
    .maybeSingle();

  if (move) {
    return (
      <SurveyClient
        token={token}
        clientName={(move.client_name as string | null) ?? ""}
        alreadyCompleted={!!move.survey_completed}
      />
    );
  }

  // 2) Lead photo request survey
  const { data: survey } = await sb
    .from("photo_surveys")
    .select("status, client_name, coordinator_name, coordinator_phone, lead_id, move_size")
    .eq("token", token)
    .maybeSingle();

  if (!survey) notFound();

  let moveSize = (survey.move_size as string | null) ?? null;
  if (moveSize == null && survey.lead_id) {
    const { data: lead } = await sb
      .from("leads")
      .select("move_size")
      .eq("id", survey.lead_id)
      .maybeSingle();
    moveSize = (lead?.move_size as string | null) ?? null;
  }

  return <PhotoSurveyClient token={token} initialSurvey={survey} moveSize={moveSize} />;
}
