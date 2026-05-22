import type { SupabaseClient } from "@supabase/supabase-js";
import { logActivity } from "@/lib/activity";
import type { DesignerPhase } from "./types";

const PHASE_ORDER: DesignerPhase[] = [
  "planning",
  "vendor_coordination",
  "staging",
  "install_ready",
  "install_scheduled",
  "completed",
];

export async function checkAndAdvanceDesignerPhase(
  projectId: string,
  db: SupabaseClient,
): Promise<DesignerPhase | null> {
  const { data: project } = await db
    .from("projects")
    .select("id, project_name, designer_phase, delivery_job_id, status")
    .eq("id", projectId)
    .single();

  if (!project || !project.designer_phase) return null;
  // Never auto-advance past install_scheduled — that requires explicit completion
  if (project.designer_phase === "completed") return null;

  const { data: vendors } = await db
    .from("project_vendors")
    .select("readiness")
    .eq("project_id", projectId);

  const { data: items } = await db
    .from("project_inventory")
    .select("item_status, status, vendor_id")
    .eq("project_id", projectId);

  const vendorList = vendors || [];
  const itemList = items || [];

  let newPhase: DesignerPhase = project.designer_phase as DesignerPhase;

  if (project.designer_phase === "planning" && vendorList.length > 0) {
    newPhase = "vendor_coordination";
  }

  if (project.designer_phase === "vendor_coordination" && vendorList.length > 0) {
    const allConfirmed = vendorList.every((v) =>
      ["confirmed", "received"].includes(v.readiness),
    );
    if (allConfirmed) newPhase = "staging";
  }

  if (project.designer_phase === "staging") {
    const vendorItems = itemList.filter((i) => i.vendor_id !== null);
    if (vendorItems.length > 0) {
      const allPickedUp = vendorItems.every((i) =>
        [
          "received_warehouse",
          "inspected",
          "stored",
          "scheduled_delivery",
          "delivered",
          "installed",
        ].includes(i.item_status || i.status || ""),
      );
      if (allPickedUp) newPhase = "install_ready";
    }
  }

  // delivery_job_id set externally by scheduleInstallDay — advance to install_scheduled
  if (
    ["planning", "vendor_coordination", "staging", "install_ready"].includes(
      project.designer_phase,
    ) &&
    project.delivery_job_id
  ) {
    newPhase = "install_scheduled";
  }

  if (newPhase === project.designer_phase) return newPhase;

  const { error } = await db
    .from("projects")
    .update({
      designer_phase: newPhase,
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  if (error) {
    console.error("[advance-phase] Failed to update designer_phase:", error.message);
    return project.designer_phase as DesignerPhase;
  }

  await logActivity({
    entity_type: "project",
    entity_id: projectId,
    event_type: "phase_advanced",
    description: `Project phase advanced to: ${newPhase.replace(/_/g, " ")}`,
    icon: "check",
  });

  return newPhase;
}

export function phaseIndex(phase: DesignerPhase): number {
  return PHASE_ORDER.indexOf(phase);
}

export { PHASE_ORDER };
