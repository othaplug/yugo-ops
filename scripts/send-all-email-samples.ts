/**
 * Send every Yugo HTML email sample (all TemplateName + shared HTML + premium booking layouts).
 * Usage: npx tsx scripts/send-all-email-samples.ts [to@email.com]
 * Requires: RESEND_API_KEY (and Supabase for email_log) in .env.local
 */
import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { sendEmail } from "@/lib/email/send";
import {
  buildStyleSampleRecipientContext,
  countAllStyleSampleEmails,
  getPremiumBookingHtmlJobs,
  getStyleSampleHtmlJobs,
  getStyleSampleTemplateJobs,
} from "@/lib/email/style-sample-jobs";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const to = (process.argv[2] ?? "othaplug@gmail.com").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.error("Invalid email:", to);
    process.exit(1);
  }

  const key = process.env.RESEND_API_KEY;
  if (!key || key === "re_your_api_key_here") {
    console.error("RESEND_API_KEY missing or placeholder in .env.local");
    process.exit(1);
  }

  const ctx = buildStyleSampleRecipientContext(to);
  const templateJobs = getStyleSampleTemplateJobs(ctx);
  const htmlJobs = getStyleSampleHtmlJobs(ctx);
  const premiumJobs = getPremiumBookingHtmlJobs(ctx);
  const total = countAllStyleSampleEmails(ctx);

  console.log(`Sending ${total} sample emails to ${to}…`);

  let n = 0;
  for (const job of templateJobs) {
    n += 1;
    const r = await sendEmail({
      to,
      subject: job.subject,
      template: job.template,
      data: job.data as never,
    });
    if (!r.success) {
      console.error(`[${n}/${total}] FAIL`, job.subject, r.error);
      process.exit(1);
    }
    console.log(`[${n}/${total}]`, job.subject, r.id ?? "");
    await delay(500);
  }

  for (const job of htmlJobs) {
    n += 1;
    const r = await sendEmail({
      to,
      subject: job.subject,
      html: job.html,
      tags: job.tag ? [{ name: "template", value: job.tag }] : undefined,
    });
    if (!r.success) {
      console.error(`[${n}/${total}] FAIL`, job.subject, r.error);
      process.exit(1);
    }
    console.log(`[${n}/${total}]`, job.subject, r.id ?? "");
    await delay(500);
  }

  for (const job of premiumJobs) {
    n += 1;
    const r = await sendEmail({
      to,
      subject: job.subject,
      html: job.html,
    });
    if (!r.success) {
      console.error(`[${n}/${total}] FAIL`, job.subject, r.error);
      process.exit(1);
    }
    console.log(`[${n}/${total}]`, job.subject, r.id ?? "");
    await delay(500);
  }

  console.log("Done. Check inbox:", to);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
