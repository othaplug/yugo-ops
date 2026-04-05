import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import SurveyClient from "./SurveyClient";

export const dynamic = "force-dynamic";

export default async function SurveyTokenPage({
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
    .select("id, client_name, survey_completed")
    .eq("survey_token", t)
    .maybeSingle();

  if (!move) notFound();

  return (
    <SurveyClient
      token={t}
      clientName={move.client_name || ""}
      alreadyCompleted={!!move.survey_completed}
    />
  );
}
