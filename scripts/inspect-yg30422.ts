import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env.local") });
async function main() {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data } = await admin.from("quotes").select("*").eq("quote_id", "YG-30422").maybeSingle();
  if (!data) { console.log("no quote"); return; }
  const view = {
    quote_id: data.quote_id,
    service_type: data.service_type,
    status: data.status,
    move_date: data.move_date,
    scheduled_date: data.scheduled_date,
    delivery_date: data.delivery_date,
    factors_applied_date: data.factors_applied?.delivery_date ?? data.factors_applied?.scheduled_date ?? null,
    factors_keys: Object.keys(data.factors_applied || {}),
  };
  console.log(view);
  const now = new Date();
  console.log("today (Toronto):", now.toLocaleDateString("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "numeric" }));
  console.log("today (UTC):", now.toISOString().slice(0, 10));
}
main();
