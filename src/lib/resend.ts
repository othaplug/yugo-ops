import { Resend } from "resend";
import type { CreateEmailOptions } from "resend";
import { applyEmailFooterTokens } from "@/lib/email/client-email-footer";
import { finalizeClientEmailHtml } from "@/lib/email/finalize-client-html";

function templateFromTags(tags?: { name: string; value: string }[]): string | undefined {
  return tags?.find((t) => t.name === "template")?.value;
}

function firstRecipientEmail(to: string | string[]): string {
  const first = Array.isArray(to) ? to[0] : to;
  return typeof first === "string" ? first : "";
}

function patchEmailHtml(payload: CreateEmailOptions): CreateEmailOptions {
  if (typeof payload.html !== "string") {
    return payload;
  }

  let html = finalizeClientEmailHtml(payload.html);

  if (
    !html.includes("__YUGO_FOOTER_RECIPIENT__") &&
    !html.includes("__YUGO_FOOTER_RECIPIENT_MAILTO__")
  ) {
    return { ...payload, html } as CreateEmailOptions;
  }

  const recipientEmail = firstRecipientEmail(payload.to);
  const fromHeader = typeof payload.from === "string" ? payload.from : "";
  const template = templateFromTags(payload.tags);
  const showMarketingTopRow = Boolean(template?.trim());

  const nextHtml = applyEmailFooterTokens(html, {
    recipientEmail,
    fromHeader: fromHeader || "Yugo <notifications@opsplus.co>",
    template,
    showMarketingTopRow,
  });
  return { ...payload, html: nextHtml } as CreateEmailOptions;
}

export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "re_your_api_key_here") {
    throw new Error("RESEND_API_KEY is not configured. Add it to your environment variables.");
  }
  const client = new Resend(key);
  const originalSend = client.emails.send.bind(client.emails);
  client.emails.send = async (payload, options) => originalSend(patchEmailHtml(payload), options);
  return client;
}
