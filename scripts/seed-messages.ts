/**
 * Seed sample messages for #ops-inbox.
 * Run with: npx tsx scripts/seed-messages.ts
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY with insert permissions)
 */
import { createClient } from "@supabase/supabase-js";

const SAMPLE_MESSAGES = [
  { thread_id: "thread-design-inquiry-001", sender_name: "Sarah Chen", sender_type: "client", content: "Hi! We have a 12-piece install going in next Tuesday at 245 Avenue Rd. Can you confirm availability?", is_read: false },
  { thread_id: "thread-design-inquiry-001", sender_name: "J. Oche", sender_type: "admin", content: "Hi Sarah — Yes, we have capacity. I'll assign Team A. Confirming 9am window?", is_read: true },
  { thread_id: "thread-design-inquiry-001", sender_name: "Sarah Chen", sender_type: "client", content: "9am works. Client will have keys ready. Thanks!", is_read: false },
  { thread_id: "thread-residential-002", sender_name: "Mike Torres", sender_type: "client", content: "Our move got pushed to Friday — is that still ok? Same addresses.", is_read: false },
  { thread_id: "thread-residential-002", sender_name: "J. Oche", sender_type: "admin", content: "No problem, Mike. I've updated the schedule. Team B will be there Friday 8–12.", is_read: true },
  { thread_id: "thread-retail-003", sender_name: "West Elm Toronto", sender_type: "client", content: "URGENT: 3 white-glove deliveries tomorrow. Can we add one more to the route?", is_read: false },
  { thread_id: "thread-retail-003", sender_name: "J. Oche", sender_type: "admin", content: "Checking crew capacity — will confirm within 30 min.", is_read: true },
  { thread_id: "thread-gallery-004", sender_name: "Bau-Xi Gallery", sender_type: "client", content: "Feinstein exhibition install — we need art handlers for Mar 1. Can you quote?", is_read: true },
  { thread_id: "thread-realtor-005", sender_name: "Jennifer Park", sender_type: "client", content: "New referral: 123 Oak St, closing March 15. Client needs full-service move + storage.", is_read: false },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, key);
  const { data: existing } = await supabase.from("messages").select("id").limit(1);
  if (existing && existing.length > 0) {
    console.log("Messages table already has data, skipping seed.");
    return;
  }
  const { error } = await supabase.from("messages").insert(SAMPLE_MESSAGES);
  if (error) {
    console.error("Seed failed:", error);
    process.exit(1);
  }
  console.log(`Seeded ${SAMPLE_MESSAGES.length} messages.`);
}

main();
