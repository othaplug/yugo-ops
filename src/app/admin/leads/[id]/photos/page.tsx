import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import LeadPhotoReviewClient from "./LeadPhotoReviewClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Photo review" };

export default async function LeadPhotoReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leadId } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) notFound();

  const db = createAdminClient();
  const { data: lead, error: le } = await db
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();
  if (le || !lead) notFound();

  const token = (lead as { photo_survey_token?: string }).photo_survey_token || "";
  let survey = null as Record<string, unknown> | null;
  if (token) {
    const { data: s } = await db
      .from("photo_surveys")
      .select("*")
      .eq("token", token)
      .maybeSingle();
    survey = (s as Record<string, unknown>) || null;
  }
  if (!survey) {
    const { data: s2 } = await db
      .from("photo_surveys")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    survey = (s2 as Record<string, unknown>) || null;
  }

  const photosRaw = (survey?.photos as Record<string, string[]>) || {};
  const photoUrls: Record<string, string[]> = {};
  for (const [room, paths] of Object.entries(photosRaw)) {
    if (!Array.isArray(paths)) continue;
    const signed: string[] = [];
    for (const p of paths) {
      if (typeof p !== "string" || !p.trim()) continue;
      const { data: u } = await db.storage
        .from("photo-surveys")
        .createSignedUrl(p.trim(), 60 * 60);
      if (u?.signedUrl) signed.push(u.signedUrl);
    }
    if (signed.length) photoUrls[room] = signed;
  }

  const { data: itemWeights } = await db
    .from("item_weights")
    .select("slug, item_name, weight_score, category, room, is_common, display_order, active, num_people_min")
    .eq("active", true)
    .order("display_order");

  const rows = (itemWeights ?? []).map((r) => ({
    ...r,
    room: r.room ?? undefined,
  }));

  return (
    <LeadPhotoReviewClient
      leadId={leadId}
      lead={lead as Record<string, unknown>}
      survey={survey}
      photoUrls={photoUrls}
      itemWeights={rows}
    />
  );
}
