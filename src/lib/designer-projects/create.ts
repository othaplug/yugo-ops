import type { SupabaseClient } from "@supabase/supabase-js";
import { generateRecordId } from "@/lib/ids/generate-id";
import { logActivity } from "@/lib/activity";

export interface CreateDesignerProjectInput {
  partnerId: string;
  projectName: string;
  endClientName: string;
  endClientContact?: string;
  siteAddress: string;
  installUnit?: string;
  installFloor?: string;
  installAccess?: string;
  installAccessNotes?: string;
  rooms?: Array<{ room: string; notes?: string }>;
  targetEndDate?: string;
  estimatedBudget?: number;
  coordinatorId?: string;
  coordinatorName?: string;
  hubspotDealId?: string;
  notes?: string;
  createdBy?: string;
}

export async function createDesignerProject(
  input: CreateDesignerProjectInput,
  db: SupabaseClient,
) {
  const projectNumber = await generateRecordId("DP", db);

  const { data: project, error } = await db
    .from("projects")
    .insert({
      project_number: projectNumber,
      partner_id: input.partnerId,
      project_name: input.projectName,
      end_client_name: input.endClientName || null,
      end_client_contact: input.endClientContact || null,
      site_address: input.siteAddress,
      install_unit: input.installUnit || null,
      install_floor: input.installFloor || null,
      install_access: input.installAccess || "elevator",
      install_access_notes: input.installAccessNotes || null,
      rooms: input.rooms || [],
      status: "active",
      designer_phase: "planning",
      target_end_date: input.targetEndDate || null,
      estimated_budget: input.estimatedBudget || null,
      coordinator_id: input.coordinatorId || null,
      coordinator_name: input.coordinatorName || null,
      hubspot_deal_id: input.hubspotDealId || null,
      notes: input.notes || null,
      created_by: input.createdBy || null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create designer project: ${error.message}`);

  await logActivity({
    entity_type: "project",
    entity_id: project.id,
    event_type: "created",
    description: `Designer project created: ${input.projectName} (${projectNumber})`,
    icon: "partner",
  });

  return project;
}
