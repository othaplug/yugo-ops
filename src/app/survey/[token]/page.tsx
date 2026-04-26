import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PhotoSurveyClient from "./PhotoSurveyClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Room photos" };

export default async function PhotoSurveyPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 8) notFound();

  const sb = createAdminClient();
  const { data: survey, error } = await sb
    .from("photo_surveys")
    .select("status, client_name, coordinator_name, coordinator_phone, lead_id, move_size")
    .eq("token", token)
    .maybeSingle();
  if (error || !survey) notFound();

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
