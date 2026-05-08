import { getConfig } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSMS } from "@/lib/sms/sendSMS";
import { getPublicQuoteUrl } from "@/lib/quote-public-url";
import { buildQuoteSmsBody, buildQuoteFollowupSmsBody } from "@/lib/quote-sms-templates";
import { buildSmsTrackUrl } from "@/lib/notifications/public-track-url";

function toE164NorthAmerica(digitsRaw: string): string | null {
  const digits = digitsRaw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  return `+${digits}`;
}

async function logSms(params: {
  phone: string;
  message: string;
  type: string;
  quoteId?: string;
  messageId?: string;
  status: "sent" | "failed";
}) {
  try {
    const admin = createAdminClient();
    await admin.from("sms_log").insert({
      recipient_phone: params.phone,
      message_body: params.message,
      message_type: params.type,
      related_id: params.quoteId ? params.quoteId : null,
      related_type: params.quoteId ? "quote" : null,
      twilio_sid: params.messageId || null,
      status: params.status,
    });
  } catch {
    // Non-critical
  }
}

/**
 * Send quote link via SMS when a quote is first sent or re-sent to the client.
 * No-ops if OpenPhone is not configured, phone invalid, or quote_sms_enabled is false.
 */
export async function sendQuoteLinkSms(params: {
  phone: string | null | undefined;
  quoteUrl?: string;
  quoteId: string;
  firstName?: string;
  serviceType?: string;
  eventName?: string | null;
}): Promise<{ ok: boolean; skipped?: string }> {
  const enabled = (await getConfig("quote_sms_enabled", "true")).toLowerCase() === "true";
  if (!enabled) return { ok: true, skipped: "quote_sms_disabled" };

  if (!params.phone?.trim() || !process.env.OPENPHONE_API_KEY || !process.env.OPENPHONE_PHONE_NUMBER_ID) {
    return { ok: true, skipped: "no_openphone_or_phone" };
  }

  const to = toE164NorthAmerica(params.phone);
  if (!to) return { ok: true, skipped: "invalid_phone" };

  const quoteUrl = params.quoteUrl ?? (await getPublicQuoteUrl(params.quoteId));
  const body = buildQuoteSmsBody({
    firstName: params.firstName,
    serviceType: params.serviceType ?? "local_move",
    quoteUrl,
    eventName: params.eventName,
  });

  const result = await sendSMS(to, body);
  if (result.success) {
    await logSms({ phone: to, message: body, type: "quote_sent", quoteId: params.quoteId, messageId: result.id, status: "sent" });
    return { ok: true };
  } else {
    console.error("[quote-sms]", result.error);
    await logSms({ phone: to, message: body, type: "quote_sent", quoteId: params.quoteId, status: "failed" });
    return { ok: false, skipped: result.error || "openphone_error" };
  }
}

export async function sendQuoteFollowupSms(params: {
  phone: string | null | undefined;
  quoteUrl?: string;
  quoteId: string;
  firstName?: string;
  serviceType?: string;
  followupNumber: 1 | 2 | 3;
  expiresAt?: string | null;
  eventName?: string | null;
}): Promise<{ ok: boolean; skipped?: string }> {
  const smsEnabled = (await getConfig("sms_enabled", "true")).toLowerCase() === "true";
  if (!smsEnabled) return { ok: true, skipped: "sms_disabled" };

  if (!params.phone?.trim() || !process.env.OPENPHONE_API_KEY || !process.env.OPENPHONE_PHONE_NUMBER_ID) {
    return { ok: true, skipped: "no_openphone_or_phone" };
  }

  const to = toE164NorthAmerica(params.phone);
  if (!to) return { ok: true, skipped: "invalid_phone" };

  const quoteUrl = params.quoteUrl ?? (await getPublicQuoteUrl(params.quoteId));
  const body = buildQuoteFollowupSmsBody({
    firstName: params.firstName,
    serviceType: params.serviceType ?? "local_move",
    quoteUrl,
    followupNumber: params.followupNumber,
    expiresAt: params.expiresAt,
    eventName: params.eventName,
  });

  const result = await sendSMS(to, body);
  if (result.success) {
    await logSms({ phone: to, message: body, type: `quote_followup_${params.followupNumber}`, quoteId: params.quoteId, messageId: result.id, status: "sent" });
    return { ok: true };
  } else {
    console.error("[quote-sms followup]", result.error);
    await logSms({ phone: to, message: body, type: `quote_followup_${params.followupNumber}`, quoteId: params.quoteId, status: "failed" });
    return { ok: false, skipped: result.error || "openphone_error" };
  }
}

export async function sendMoveReminderSms(params: {
  phone: string | null | undefined;
  moveCode: string;
  clientName?: string;
  moveDate: string;
  scheduledTime?: string | null;
  crewSize?: number | null;
  trackingUrl: string;
  reminderType: "72hr" | "24hr" | "confirmation";
}): Promise<{ ok: boolean; skipped?: string }> {
  const smsEnabled = (await getConfig("sms_enabled", "true")).toLowerCase() === "true";
  const premoveEnabled = (await getConfig("sms_premove_enabled", "true")).toLowerCase() === "true";
  if (!smsEnabled || !premoveEnabled) return { ok: true, skipped: "sms_disabled" };

  if (!params.phone?.trim() || !process.env.OPENPHONE_API_KEY || !process.env.OPENPHONE_PHONE_NUMBER_ID) {
    return { ok: true, skipped: "no_openphone_or_phone" };
  }

  const to = toE164NorthAmerica(params.phone);
  if (!to) return { ok: true, skipped: "invalid_phone" };

  const fmtDate = formatMoveDate(params.moveDate);
  const firstName = params.clientName ? params.clientName.split(" ")[0] : "";
  const greet = firstName ? `Hi ${firstName},` : "Hi,";
  const smsUrl = /^[A-Z]{2,}-\d+$/.test(params.moveCode.toUpperCase())
    ? buildSmsTrackUrl(params.moveCode)
    : params.trackingUrl;

  let body: string;
  if (params.reminderType === "confirmation") {
    body = [
      greet,
      `Your move with Yugo is confirmed for ${fmtDate}. We are looking forward to taking great care of you.`,
      `Track your move details:\n${smsUrl}`,
    ].join("\n\n");
  } else if (params.reminderType === "72hr") {
    const timeLine = params.scheduledTime ? `\n\nStart time: ${params.scheduledTime}.` : "";
    body = [
      greet,
      `Your move with Yugo is in 3 days, on ${fmtDate}.${timeLine}`,
      `Questions before the big day? Reply here or call (647) 370-4525 — we are happy to help.`,
    ].join("\n\n");
  } else {
    const crewLine = `Your crew of ${params.crewSize ?? "2–3"} will be arriving${params.scheduledTime ? ` at ${params.scheduledTime}` : ""}.`;
    body = [
      greet,
      `Your Yugo move is tomorrow. We have everything ready for a smooth day.`,
      crewLine,
      `Track your crew live:\n${smsUrl}`,
    ].join("\n\n");
  }

  const result = await sendSMS(to, body);
  if (result.success) {
    await logSms({ phone: to, message: body, type: `move_reminder_${params.reminderType}`, messageId: result.id, status: "sent" });
    return { ok: true };
  } else {
    console.error("[move-sms]", result.error);
    return { ok: false, skipped: result.error || "openphone_error" };
  }
}

function formatMoveDate(dateStr: string): string {
  try {
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}
