/**
 * Send quote HTML samples only (`quote-templates.ts` / renderQuoteTemplate).
 * Usage: npx tsx scripts/send-quote-template-samples.ts [to@email.com] [--all]
 * Default: one residential sample. With --all: all quote-templates.ts variants (10 emails).
 * Requires: RESEND_API_KEY in .env.local
 */
import { config as loadEnv } from "dotenv";
import path from "path";

loadEnv({ path: path.join(process.cwd(), ".env.local") });

import { sendEmail } from "@/lib/email/send";
import {
  buildStyleSampleRecipientContext,
  getStyleSampleTemplateJobs,
} from "@/lib/email/style-sample-jobs";

/** Only templates rendered by `renderQuoteTemplate` in quote-templates.ts */
const QUOTE_HTML_TEMPLATES = new Set([
  "quote-residential",
  "quote-longdistance",
  "quote-office",
  "quote-singleitem",
  "quote-whiteglove",
  "quote-specialty",
  "quote-event",
  "quote-labouronly",
  "quote-binrental",
  "quote-b2boneoff",
]);

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--all");
  const sendAll = process.argv.includes("--all");
  const to = (args[0] ?? "othaplug@gmail.com").trim();
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
  let jobs = getStyleSampleTemplateJobs(ctx).filter((j) =>
    QUOTE_HTML_TEMPLATES.has(j.template),
  );

  if (!sendAll) {
    jobs = jobs.filter((j) => j.template === "quote-residential");
  }

  console.log(`Sending ${jobs.length} quote sample(s) to ${to}…`);

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const r = await sendEmail({
      to,
      subject: job.subject,
      template: job.template,
      data: job.data as never,
    });
    if (!r.success) {
      console.error("FAIL", job.subject, r.error);
      process.exit(1);
    }
    console.log(`[${i + 1}/${jobs.length}]`, job.subject, r.id ?? "");
    if (i < jobs.length - 1) await delay(600);
  }
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
