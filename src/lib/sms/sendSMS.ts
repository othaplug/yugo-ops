import { notifyAdmins } from "@/lib/notifications/dispatch";

function toE164NorthAmerica(raw: string): string {
  let phone = raw.trim();
  if (!phone.startsWith("+")) {
    phone = "+1" + phone.replace(/\D/g, "");
  }
  return phone;
}

/**
 * Provider errors that mean every subsequent SMS will also fail until an
 * operator tops up the prepaid balance or reactivates the account — i.e.
 * NOT a per-recipient issue. When we see one of these, page an admin (once
 * per 24h, in-process throttle) so the outage can't go silent like it did
 * on MV-30270 / 2026-06-22.
 */
function isSystemicSmsProviderError(err: string | null | undefined): boolean {
  const e = (err || "").toLowerCase();
  return (
    e.includes("prepaid credit") ||
    e.includes("insufficient balance") ||
    e.includes("insufficient credit") ||
    e.includes("not enough credit") ||
    e.includes("account is suspended") ||
    e.includes("account suspended") ||
    e.includes("billing")
  );
}

let lastProviderAlertAt = 0;
async function maybeAlertOnProviderFailure(error: string | null | undefined): Promise<void> {
  if (!isSystemicSmsProviderError(error)) return;
  const now = Date.now();
  if (now - lastProviderAlertAt < 24 * 60 * 60 * 1000) return;
  lastProviderAlertAt = now;
  try {
    await notifyAdmins("sms_provider_failure", {
      subject: "SMS provider rejecting messages — top up required",
      body: `An outbound SMS just failed with: "${error}". No further outbound texts will reach customers, partners, or crew until the SMS provider account is topped up (https://my.quo.com/settings/billing). This alert fires at most once every 24 hours.`,
      description: "Outbound SMS path is silently failing; provider returned an account-level error.",
    });
  } catch { /* alerting is best-effort */ }
}

export async function sendSMS(
  to: string,
  body: string
): Promise<{ success: boolean; id?: string; error?: string }> {
  const apiKey = process.env.OPENPHONE_API_KEY;
  const phoneNumberId = process.env.OPENPHONE_PHONE_NUMBER_ID;

  if (!apiKey || !phoneNumberId) {
    return { success: false, error: "OpenPhone not configured" };
  }

  try {
    const formattedPhone = toE164NorthAmerica(to);

    const response = await fetch("https://api.openphone.com/v1/messages", {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: body,
        to: [formattedPhone],
        from: phoneNumberId,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data.message || "OpenPhone API error";
      // Alert from the chokepoint so EVERY sendSMS caller is covered
      // (previously the alert lived only in sendClientTrackingCheckpointSms,
      // which left partner/crew/bin/quote-photo/lead-intake paths silent).
      void maybeAlertOnProviderFailure(error);
      return { success: false, error };
    }

    return { success: true, id: data.data?.id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("OpenPhone SMS error:", msg);
    void maybeAlertOnProviderFailure(msg);
    return { success: false, error: msg };
  }
}
