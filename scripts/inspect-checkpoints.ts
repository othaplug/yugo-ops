import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
async function main() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data } = await admin.from("tracking_sessions")
    .select("checkpoints")
    .eq("id", "7700cda9-1678-4786-80e1-c37aba562e6b")
    .single();
  console.log(JSON.stringify(data?.checkpoints, null, 2));
}
main();
