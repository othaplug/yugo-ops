/**
 * Seed a crew member for development.
 * Usage: npx tsx scripts/seed-crew-member.ts
 *
 * Loads .env.local so CREW_SESSION_SECRET matches the app. Uses the same
 * hashCrewPin as the app so PINs work correctly.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { hashCrewPin } from "@/lib/crew-token";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

async function main() {
  const supabase = createClient(url, key);

  const { data: crews } = await supabase.from("crews").select("id, name").limit(1);
  if (!crews?.length) {
    console.error("No crews found. Create a crew first in admin → Tracking.");
    process.exit(1);
  }

  const teamId = crews[0].id;
  const phone = "6475550123";
  const pin = "123456";
  const pinHash = hashCrewPin(pin);

  let existing = (await supabase.from("crew_members").select("id").eq("phone", phone).maybeSingle()).data;
  if (!existing) {
    const byName = (await supabase.from("crew_members").select("id, name").ilike("name", "%Olu%").limit(1)).data;
    if (byName?.[0]) {
      existing = byName[0];
      console.log("Found existing Olu by name, updating PIN. Phone in DB:", (await supabase.from("crew_members").select("phone").eq("id", existing.id).single()).data?.phone);
    }
  }

  if (existing) {
    await supabase
      .from("crew_members")
      .update({ pin_hash: pinHash, is_active: true, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    console.log("Updated crew member PIN. Login: phone", phone, "PIN", pin);
  } else {
    const { data: created, error } = await supabase
      .from("crew_members")
      .insert({
        name: "Olu (Lead)",
        phone,
        pin_hash: pinHash,
        role: "lead",
        team_id: teamId,
        is_active: true,
        avatar_initials: "OL",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Insert error:", error);
      process.exit(1);
    }
    console.log("Created crew member. Login: phone", phone, "PIN", pin);
  }
}

main();
