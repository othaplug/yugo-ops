export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import DesignerProjectCommandCenter from "./DesignerProjectCommandCenter";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();
  const { data } = await db
    .from("projects")
    .select("project_name, project_number")
    .eq("id", id)
    .not("designer_phase", "is", null)
    .single();
  return { title: data ? `${data.project_number} · ${data.project_name}` : "Designer Project" };
}

export default async function DesignerProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: project, error } = await db
    .from("projects")
    .select(
      `
      *,
      organizations:partner_id(id, name, type, email, contact_email),
      project_vendors(*),
      project_inventory(*),
      project_timeline(id, event_type, event_description, photos, created_at, user_id)
    `,
    )
    .eq("id", id)
    .not("designer_phase", "is", null)
    .single();

  if (error || !project) notFound();

  // Sort vendors by sort_order
  if (project.project_vendors) {
    project.project_vendors.sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
    );
  }
  // Sort timeline newest first
  if (project.project_timeline) {
    project.project_timeline.sort(
      (a: { created_at: string }, b: { created_at: string }) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }

  // Fetch linked delivery job if present
  let deliveryJob = null;
  if (project.delivery_job_id) {
    const { data: dj } = await db
      .from("deliveries")
      .select("id, delivery_number, status, delivery_date, delivery_address")
      .eq("id", project.delivery_job_id)
      .single();
    deliveryJob = dj;
  }

  return <DesignerProjectCommandCenter project={{ ...project, deliveryJob }} />;
}
