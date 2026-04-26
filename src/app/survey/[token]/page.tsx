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
    .select("status, client_name, coordinator_name, coordinator_phone, lead_id")
    .eq("token", token)
    .maybeSingle();
  if (error || !survey) notFound();

  return <PhotoSurveyClient token={token} initialSurvey={survey} />;
}
