import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
async function main() {
  const apply = process.argv.includes("--apply");
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: before, error: e0 } = await admin.from("moves")
    .select("id, move_code, arrival_window")
    .eq("move_code", "MV-30403").single();
  if (e0) { console.error(e0); return; }
  console.log("before:", before);
  if (!apply) { console.log("dry run"); return; }
  const { error } = await admin.from("moves").update({ arrival_window: null }).eq("id", before!.id);
  if (error) console.error(error); else console.log("cleared MV-30403 arrival_window; original prose still lives in the client SMS thread");
}
main();
