import type { SupabaseClient } from "@supabase/supabase-js";

export async function appendInboundShipmentLog(
  admin: SupabaseClient,
  shipmentId: string,
  status: string,
  opts?: { notes?: string | null; photos?: unknown[]; createdBy?: string | null },
): Promise<void> {
  await admin.from("shipment_status_log").insert({
    shipment_id: shipmentId,
    status,
    notes: opts?.notes ?? null,
    photos: opts?.photos ?? [],
    created_by: opts?.createdBy ?? null,
  });
}
