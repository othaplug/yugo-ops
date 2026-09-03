/**
 * Generate a client-facing resign URL for a delivery whose crew-side
 * signature was lost mid-flight, and optionally SMS it to the
 * recipient. The token is HMAC-signed and long-lived (no expiry) — burn
 * it after use by re-issuing if needed.
 *
 * Usage:
 *   npx tsx scripts/send-delivery-resign-link.ts DLV-30412             # print URL only
 *   npx tsx scripts/send-delivery-resign-link.ts DLV-30412 --send      # SMS the recipient
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

async function main() {
  const code = (process.argv[2] || "").trim().toUpperCase();
  const send = process.argv.includes("--send");
  if (!code) {
    console.error("pass a delivery code, e.g. DLV-30412");
    process.exit(1);
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const { signResignToken } = await import("@/lib/track-token");
  const { getEmailBaseUrl } = await import("@/lib/email-base-url");

  const admin = createAdminClient();
  const { data: delivery, error } = await admin
    .from("deliveries")
    .select(
      "id, delivery_number, customer_name, customer_phone, recipient_name, recipient_phone, business_name, signoff_completed_at",
    )
    .eq("delivery_number", code)
    .maybeSingle();
  if (error || !delivery) {
    console.error("delivery not found:", code);
    process.exit(1);
  }

  const fullToken = signResignToken(delivery.id);
  const sigOnly = fullToken.split(".").slice(1).join(".");
  const base = getEmailBaseUrl().replace(/\/$/, "");
  const url = `${base}/delivery/resign/${encodeURIComponent(delivery.delivery_number)}?token=${sigOnly}`;

  const recipientName =
    (delivery as { recipient_name?: string | null }).recipient_name ||
    delivery.customer_name ||
    "there";
  const recipientPhone =
    (delivery as { recipient_phone?: string | null }).recipient_phone ||
    delivery.customer_phone ||
    null;

  console.log(`delivery      : ${delivery.delivery_number} (${delivery.business_name || "—"})`);
  console.log(`recipient     : ${recipientName}`);
  console.log(`phone         : ${recipientPhone || "—"}`);
  console.log(`signoff state : ${delivery.signoff_completed_at ? "closed" : "open"}`);
  console.log("");
  console.log("resign URL:");
  console.log(url);

  if (!send) {
    console.log("\ndry run. pass --send to SMS the recipient.");
    return;
  }
  if (!recipientPhone) {
    console.error("no phone on record; cannot SMS.");
    process.exit(1);
  }

  const { sendSMS } = await import("@/lib/sms/sendSMS");
  const first = String(recipientName).trim().split(/\s+/)[0] || "there";
  const body = [
    `Hi ${first},`,
    `Our crew's connection dropped while capturing your signature for delivery ${delivery.delivery_number}. Please sign here so we can close out:`,
    url,
    `Thanks — Yugo`,
  ].join("\n\n");
  const res = await sendSMS(recipientPhone, body);
  console.log("\nSMS result:", res);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
