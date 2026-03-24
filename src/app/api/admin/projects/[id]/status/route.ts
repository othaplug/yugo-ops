import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import {
  deriveHandledByFromDeliveryMethod,
  getLegacyStatusFromProjectItemStatus,
  getProjectItemStatus,
  getProjectItemStatusLabel,
  isValidProjectItemStatus,
} from "@/lib/project-item-status";
import { createPartnerNotification, notifyAllAdmins } from "@/lib/notifications";
import { sendEmail } from "@/lib/email/send";
import { projectItemStatusEmailHtml } from "@/lib/email-templates";
import { getEmailBaseUrl } from "@/lib/email-base-url";

const TIMELINE_EVENTS: Record<string, string> = {
  ready_for_pickup: "item_ready",
  received_warehouse: "item_received",
  delivered: "item_delivered",
  installed: "item_installed",
  issue_reported: "issue_flagged",
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error } = await requireStaff();
  if (error) return error;

  const { id: projectId } = await params;
  const db = createAdminClient();
  const body = await req.json();
  const { item_id, item_status, notes } = body;

  if (!item_id) {
    return NextResponse.json({ error: "item_id required" }, { status: 400 });
  }
  if (!isValidProjectItemStatus(item_status)) {
    return NextResponse.json({ error: "Invalid item_status" }, { status: 400 });
  }

  const { data: item, error: fetchErr } = await db
    .from("project_inventory")
    .select("id, item_name, item_status, status, phase_id, vendor_delivery_method, handled_by, projects(partner_id, project_name, project_number)")
    .eq("id", item_id)
    .eq("project_id", projectId)
    .single();
  if (fetchErr || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const oldStatus = getProjectItemStatus(item);
  const updatePayload: Record<string, unknown> = {
    item_status,
    status: getLegacyStatusFromProjectItemStatus(item_status),
    status_updated_at: new Date().toISOString(),
    status_notes: typeof notes === "string" ? notes.trim() || null : null,
  };
  if (item_status === "received_warehouse") {
    updatePayload.received_date = new Date().toISOString().slice(0, 10);
  }
  if (item_status === "delivered") {
    updatePayload.delivered_date = new Date().toISOString().slice(0, 10);
  }
  if (
    !("handled_by" in item) ||
    !item.handled_by ||
    (item_status === "ready_for_pickup" && item.vendor_delivery_method)
  ) {
    updatePayload.handled_by = deriveHandledByFromDeliveryMethod(item.vendor_delivery_method);
  }

  const { data: updated, error: updateErr } = await db
    .from("project_inventory")
    .update(updatePayload)
    .eq("id", item_id)
    .eq("project_id", projectId)
    .select()
    .single();
  if (updateErr || !updated) {
    return NextResponse.json({ error: updateErr?.message || "Failed to update item" }, { status: 500 });
  }

  try {
    await db.from("project_status_log").insert({
      project_id: projectId,
      item_id,
      old_status: oldStatus,
      new_status: item_status,
      changed_by: user?.email || "admin",
      notes: updatePayload.status_notes,
    });
  } catch {
    // Non-fatal history write.
  }

  try {
    await db.from("project_timeline").insert({
      project_id: projectId,
      event_type: TIMELINE_EVENTS[item_status] || "item_status_changed",
      event_description: `${item.item_name} -> ${getProjectItemStatusLabel(item_status)}${updatePayload.status_notes ? `: ${updatePayload.status_notes}` : ""}`,
      phase_id: item.phase_id,
    });
  } catch {
    // Non-fatal timeline write.
  }

  // Notify partner/designer of status change (in-app + email)
  try {
    const proj = (item as any).projects;
    if (proj?.partner_id) {
      const statusLabel = getProjectItemStatusLabel(item_status);
      const projectRef = proj.project_number ? `${proj.project_number} · ${proj.project_name}` : proj.project_name;

      // In-app notification
      await createPartnerNotification({
        orgId: proj.partner_id,
        title: `Item status updated: ${item.item_name}`,
        body: `${item.item_name} is now "${statusLabel}", ${projectRef}`,
        icon: "package",
        link: `/partner/projects/${projectId}`,
      });

      // Email — look up the partner org's contact email
      const { data: org } = await db
        .from("organizations")
        .select("email, contact_name, name")
        .eq("id", proj.partner_id)
        .single();

      if (org?.email) {
        const baseUrl = getEmailBaseUrl();
        const portalUrl = `${baseUrl}/partner/projects/${projectId}`;
        const isIssue = item_status === "issue_reported";

        await sendEmail({
          to: org.email,
          subject: isIssue
            ? `Issue reported on ${item.item_name}, ${proj.project_name}`
            : `${item.item_name} is now ${statusLabel}, ${proj.project_name}`,
          html: projectItemStatusEmailHtml({
            partnerName: org.contact_name || org.name,
            projectName: proj.project_name,
            projectNumber: proj.project_number || "",
            itemName: item.item_name,
            statusLabel,
            statusKey: item_status,
            notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
            portalUrl,
          }),
        });
      }
    }
  } catch {
    // Non-fatal notification + email.
  }

  // Notify all admins if item is ready for pickup (e.g. designer marks it)
  if (item_status === "ready_for_pickup") {
    try {
      const proj = (item as any).projects;
      await notifyAllAdmins({
        title: `Item ready for pickup: ${item.item_name}`,
        body: proj?.project_name ? `On project ${proj.project_name}` : undefined,
        icon: "truck",
        link: `/admin/projects/${projectId}`,
        sourceType: "project",
        sourceId: projectId,
      });
    } catch {
      // Non-fatal
    }
  }

  const effectiveHandledBy =
    updated.handled_by ||
    deriveHandledByFromDeliveryMethod(updated.vendor_delivery_method);

  return NextResponse.json({
    ...updated,
    should_schedule:
      item_status === "ready_for_pickup" &&
      (updated.vendor_delivery_method === "yugo_pickup" || effectiveHandledBy === "yugo"),
  });
}
