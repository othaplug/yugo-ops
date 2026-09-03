/**
 * Inspect DLV-30412 (Andre Alves / Studio321B).
 *
 * Investigating: crew signed the client off, delivery marked complete,
 * then the crew app re-showed the sign-out prompt on reload as if the
 * signature never landed.
 *
 * Usage:  npx tsx scripts/inspect-dlv30412.ts
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const { data: d } = await admin
    .from("deliveries")
    .select("*")
    .eq("delivery_number", "DLV-30412")
    .maybeSingle();
  if (!d) {
    console.log("no delivery");
    return;
  }

  const columnKeys = [
    "id",
    "delivery_number",
    "status",
    "stage",
    "signoff_completed_at",
    "signature_captured",
    "signature_data_url",
    "client_signed_off_at",
    "signed_off_at",
    "completed_at",
    "delivered_at",
    "delivered_by",
    "assigned_crew_id",
    "walkthrough_completed_at",
    "is_multi_stop",
    "final_price",
    "admin_adjusted_price",
    "total_price",
    "quoted_price",
    "business_name",
    "customer_name",
  ];
  console.log("=== DELIVERY ===");
  const view = Object.fromEntries(columnKeys.map((k) => [k, (d as Record<string, unknown>)[k]]));
  console.log(view);

  // client_sign_offs rows for this delivery
  const { data: signoffs } = await admin
    .from("client_sign_offs")
    .select("id, job_id, job_type, signature_data_url, created_at, notes, name")
    .eq("job_id", d.id);
  console.log("\n=== client_sign_offs on job_id ===");
  console.log(signoffs);

  const { data: signoffsByNumber } = await admin
    .from("client_sign_offs")
    .select("id, job_id, job_type, signature_data_url, created_at, notes, name")
    .eq("job_id", d.delivery_number);
  console.log("\n=== client_sign_offs on job_id = delivery_number ===");
  console.log(signoffsByNumber);

  // Tracking sessions checkpoints
  const { data: ts } = await admin
    .from("tracking_sessions")
    .select("id, job_id, job_type, checkpoints, created_at, completed_at")
    .eq("job_id", d.id)
    .order("created_at", { ascending: false })
    .limit(3);
  console.log("\n=== tracking_sessions (recent 3) ===");
  console.log(ts);

  // Any delivery_stops with signature data
  const { data: stops } = await admin
    .from("delivery_stops")
    .select("id, delivery_id, stop_order, status, completed_at, signature_data_url, signed_off_at, delivered_at")
    .eq("delivery_id", d.id)
    .order("stop_order", { ascending: true });
  console.log("\n=== delivery_stops ===");
  console.log(stops);

  // status_events for audit trail
  const { data: events } = await admin
    .from("status_events")
    .select("event_type, description, created_at")
    .or(`entity_id.eq.${d.id},entity_id.eq.${d.delivery_number}`)
    .order("created_at", { ascending: false })
    .limit(30);
  console.log("\n=== status_events (recent 30) ===");
  console.log(events);

  // move_documents / files linked
  const { data: files } = await admin.storage
    .from("move-documents")
    .list(`deliveries/${d.id}`, { limit: 40 });
  console.log(`\n=== storage: deliveries/${d.id} ===`);
  console.log(files);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
