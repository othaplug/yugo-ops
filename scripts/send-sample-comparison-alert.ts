/**
 * Send a sample quote-comparison admin notification (fixture data).
 *
 * Usage:
 *   npx tsx scripts/send-sample-comparison-alert.ts [recipient@email.com]
 *
 * Requires .env.local: RESEND_API_KEY (+ Supabase admin vars for email_log insert).
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

import { quoteComparisonSignalAdminEmailHtml } from "../src/lib/email/admin-templates";
import { sendEmail } from "../src/lib/email/send";

async function main() {
  const to = (process.argv[2] || "othaplug@gmail.com").trim();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ops.helloyugo.com";

  const html = quoteComparisonSignalAdminEmailHtml({
    clientFirstName: "Alex",
    clientFullName: "Alex Sample",
    clientEmail: "client@example.com",
    clientPhone: "(416) 555-0100",
    publicQuoteId: "YQ-SAMPLE-001",
    moveDateLabel: "May 15, 2026",
    moveSizeLabel: "2 bedroom",
    fromAddress: "100 Queen St W, Toronto, ON",
    toAddress: "88 Harbour St, Toronto, ON",
    tierPrices: { essential: 1299, signature: 1899, estate: 2899 },
    viewCount: 5,
    uniqueDays: 3,
    tierClickCounts: { essential: 1, signature: 2, estate: 4 },
    maxSessionSeconds: 3720,
    lastEngagementLabel: "Apr 5, 2026, 8:42 p.m.",
    adminQuoteUrl: `${baseUrl.replace(/\/$/, "")}/admin/quotes/YQ-SAMPLE-001`,
  });

  const subject = "[Sample] Alex may be comparing quotes · YQ-SAMPLE-001";

  const result = await sendEmail({
    to,
    subject,
    html,
  });

  if (!result.success) {
    console.error("Send failed:", result.error);
    process.exit(1);
  }
  console.log("Sent sample comparison alert to", to, result.id ? `(id ${result.id})` : "");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
