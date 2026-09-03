import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
async function main() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data, error } = await admin.from("deliveries")
    .select("id, delivery_number, crew_id, status, stage, assigned_members")
    .eq("delivery_number", "DLV-30412")
    .single();
  console.log("delivery crew fields:", data, "error:", error);
  const { data: skip } = await admin.from("signoff_skips")
    .select("team_id, crew_member_id")
    .eq("job_id", data!.id)
    .single();
  console.log("skip team_id:", skip);
  console.log("delivery.crew_id === skip.team_id?", data!.crew_id === skip!.team_id);
}
main();
