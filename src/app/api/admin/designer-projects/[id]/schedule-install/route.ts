import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { scheduleInstallDay } from "@/lib/designer-projects/schedule-install";
import { createPartnerNotification } from "@/lib/notifications";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id: projectId } = await params;
  const body = await req.json();
  const { installDate } = body;

  if (!installDate) {
    return NextResponse.json({ error: "installDate is required (YYYY-MM-DD)" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { deliveryId, deliveryNumber } = await scheduleInstallDay(projectId, installDate, db);

    // Notify the partner org
    const { data: project } = await db
      .from("projects")
      .select("partner_id, project_name, project_number")
      .eq("id", projectId)
      .single();

    if (project?.partner_id) {
      await createPartnerNotification({
        orgId: project.partner_id,
        title: `Install Day Scheduled — ${project.project_name}`,
        body: `Your install is confirmed for ${installDate}. Job ${deliveryNumber} has been created.`,
        icon: "check",
        link: `/partner?project=${projectId}`,
        deliveryId,
      });
    }

    return NextResponse.json({ deliveryId, deliveryNumber });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to schedule install";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
