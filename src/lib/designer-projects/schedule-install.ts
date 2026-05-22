import type { SupabaseClient } from "@supabase/supabase-js";
import { generateRecordId } from "@/lib/ids/generate-id";
import { logActivity } from "@/lib/activity";

export async function scheduleInstallDay(
  projectId: string,
  installDate: string, // YYYY-MM-DD
  db: SupabaseClient,
): Promise<{ deliveryId: string; deliveryNumber: string }> {
  const { data: project, error: pErr } = await db
    .from("projects")
    .select(
      `
      *,
      organizations:partner_id(id, name, type),
      project_vendors(*, readiness),
      project_inventory(*, vendor_id)
    `,
    )
    .eq("id", projectId)
    .single();

  if (pErr || !project) throw new Error("Project not found");
  if (project.delivery_job_id) throw new Error("Install day already scheduled");

  const deliveryNumber = await generateRecordId("DLV", db);
  const org = project.organizations as { id: string; name: string; type: string } | null;

  const { data: delivery, error: dErr } = await db
    .from("deliveries")
    .insert({
      delivery_number: deliveryNumber,
      organization_id: project.partner_id,
      client_name: project.end_client_name || org?.name || "",
      business_name: org?.name || null,
      category: "designer",
      vertical_code: "designer",
      is_multi_stop: true,
      project_id: projectId,
      project_name: project.project_name,
      end_client_name: project.end_client_name || null,
      delivery_date: installDate,
      delivery_address: project.site_address || "",
      delivery_unit: project.install_unit || null,
      delivery_access: project.install_access || "elevator",
      access_notes: project.install_access_notes || null,
      total_price: project.estimated_budget || null,
      status: "scheduled",
      total_stops:
        (project.project_vendors || []).filter(
          (v: { readiness: string }) => v.readiness !== "received",
        ).length + 1,
    })
    .select("id")
    .single();

  if (dErr || !delivery) throw new Error(`Failed to create delivery: ${dErr?.message}`);

  // Create pickup stops from vendors (skip already-received ones)
  const vendorsToPickup = (project.project_vendors || [])
    .filter((v: { readiness: string }) => v.readiness !== "received")
    .sort(
      (a: { sort_order: number }, b: { sort_order: number }) => a.sort_order - b.sort_order,
    );

  for (let i = 0; i < vendorsToPickup.length; i++) {
    const vendor = vendorsToPickup[i];
    const vendorItems = (project.project_inventory || []).filter(
      (item: { vendor_id: string | null }) => item.vendor_id === vendor.id,
    );

    const { data: stop, error: stopErr } = await db
      .from("delivery_stops")
      .insert({
        delivery_id: delivery.id,
        stop_number: i + 1,
        stop_type: "pickup",
        vendor_name: vendor.vendor_name,
        address: vendor.vendor_address || "",
        contact_name: vendor.contact_name || null,
        contact_phone: vendor.contact_phone || null,
        access_type: vendor.vendor_access || "ground_floor",
        access_notes: vendor.vendor_access_notes || null,
        readiness: vendor.readiness,
        readiness_notes: vendor.readiness_notes || null,
        stop_status: i === 0 ? "current" : "pending",
        status: i === 0 ? "current" : "pending",
        services_selected: [],
      })
      .select("id")
      .single();

    if (stopErr || !stop) {
      console.error("[schedule-install] stop insert failed:", stopErr?.message);
      continue;
    }

    for (const item of vendorItems) {
      await db.from("delivery_stop_items").insert({
        stop_id: stop.id,
        description: item.item_name,
        quantity: item.quantity || 1,
        weight_range: "standard",
        is_fragile: false,
        is_high_value: !!item.item_value && item.item_value > 500,
        requires_assembly: !!item.requires_assembly,
        status: "pending",
      });
    }
  }

  // Final stop: install address
  await db.from("delivery_stops").insert({
    delivery_id: delivery.id,
    stop_number: vendorsToPickup.length + 1,
    stop_type: "delivery",
    address: project.site_address || "",
    is_final_destination: true,
    stop_status: "pending",
    status: "pending",
    services_selected: [],
  });

  // Link delivery back to the project and advance phase
  await db
    .from("projects")
    .update({
      delivery_job_id: delivery.id,
      target_end_date: installDate,
      designer_phase: "install_scheduled",
      updated_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  await logActivity({
    entity_type: "project",
    entity_id: projectId,
    event_type: "install_scheduled",
    description: `Install day scheduled: ${deliveryNumber} on ${installDate}`,
    icon: "delivery",
  });

  await logActivity({
    entity_type: "delivery",
    entity_id: delivery.id,
    event_type: "created",
    description: `Install day delivery created from project ${project.project_number}: ${project.project_name}`,
    icon: "delivery",
  });

  return { deliveryId: delivery.id, deliveryNumber };
}
