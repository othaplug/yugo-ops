import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
async function main() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: skips } = await admin.from("signoff_skips")
    .select("*")
    .eq("job_id", "d93674d8-2c6d-4e73-ab8f-1a40704cbf8a")
    .order("created_at", { ascending: false });
  console.log("=== signoff_skips ===");
  console.log(skips);
  const { data: pod } = await admin.from("proof_of_delivery")
    .select("id, delivery_id, signature_data, signer_name, signed_at, created_at")
    .eq("delivery_id", "d93674d8-2c6d-4e73-ab8f-1a40704cbf8a")
    .order("created_at", { ascending: false });
  console.log("\n=== proof_of_delivery ===");
  console.log(pod);
}
main();
