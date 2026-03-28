export const metadata = { title: "Lead" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import LeadDetailClient from "./LeadDetailClient";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = createAdminClient();

  const { data: lead, error } = await sb.from("leads").select("*").eq("id", id).single();
  if (error || !lead) notFound();

  const { data: activities } = await sb
    .from("lead_activities")
    .select("id, activity_type, notes, created_at, performed_by")
    .eq("lead_id", id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <LeadDetailClient leadId={id} initialLead={lead as Record<string, unknown>} initialActivities={activities ?? []} />
  );
}
