import { NextRequest, NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/check-role";
import { sendEmail } from "@/lib/email/send";
import {
  buildStyleSampleRecipientContext,
  countAllStyleSampleEmails,
  getPremiumBookingHtmlJobs,
  getStyleSampleHtmlJobs,
  getStyleSampleTemplateJobs,
} from "@/lib/email/style-sample-jobs";

const DEFAULT_TO = "othaplug@gmail.com";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Owner-only: send one sample of each client lifecycle / shared HTML email for design QA.
 * POST /api/admin/email/send-style-samples
 * Body (optional): { "to": "you@domain.com", "dryRun": false }
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  const key = process.env.RESEND_API_KEY;
  if (!key || key === "re_your_api_key_here") {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured. Cannot send samples." },
      { status: 503 },
    );
  }

  let body: { to?: string; dryRun?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const to = (typeof body.to === "string" && body.to.trim()) || DEFAULT_TO;
  const dryRun = Boolean(body.dryRun);
  const ctx = buildStyleSampleRecipientContext(to);

  const templateJobs = getStyleSampleTemplateJobs(ctx);
  const htmlJobs = getStyleSampleHtmlJobs(ctx);
  const premiumJobs = getPremiumBookingHtmlJobs(ctx);

  const results: { subject: string; ok: boolean; id?: string; error?: string }[] = [];

  if (dryRun) {
    const subjects = [
      ...templateJobs.map((j) => j.subject),
      ...htmlJobs.map((j) => j.subject),
      ...premiumJobs.map((j) => j.subject),
    ];
    return NextResponse.json({
      ok: true,
      dryRun: true,
      to,
      count: countAllStyleSampleEmails(ctx),
      subjects,
    });
  }

  for (const job of templateJobs) {
    const r = await sendEmail({
      to,
      subject: job.subject,
      template: job.template,
      data: job.data as never,
    });
    results.push({
      subject: job.subject,
      ok: r.success,
      id: r.id,
      error: r.error,
    });
    await delay(450);
  }

  for (const job of htmlJobs) {
    const r = await sendEmail({
      to,
      subject: job.subject,
      html: job.html,
      tags: job.tag ? [{ name: "template", value: job.tag }] : undefined,
    });
    results.push({
      subject: job.subject,
      ok: r.success,
      id: r.id,
      error: r.error,
    });
    await delay(450);
  }

  for (const job of premiumJobs) {
    const r = await sendEmail({
      to,
      subject: job.subject,
      html: job.html,
    });
    results.push({
      subject: job.subject,
      ok: r.success,
      id: r.id,
      error: r.error,
    });
    await delay(450);
  }

  const failed = results.filter((x) => !x.ok);
  return NextResponse.json({
    ok: failed.length === 0,
    to,
    sent: results.length,
    failed: failed.length,
    results,
  });
}
