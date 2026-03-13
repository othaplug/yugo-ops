import { twilioClient } from "@/lib/twilio";

const fromNumber = process.env.TWILIO_PHONE_NUMBER || process.env.TWILIO_FROM_NUMBER || "";

export async function sendSMS(
  to: string,
  body: string
): Promise<{ success: boolean; sid?: string; error?: string }> {
  try {
    if (!fromNumber || !process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      return { success: false, error: "Twilio not configured" };
    }

    let formattedPhone = to.trim();
    if (formattedPhone.startsWith("(") || formattedPhone.match(/^\d/)) {
      formattedPhone = "+1" + formattedPhone.replace(/\D/g, "");
    }
    if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+" + formattedPhone;
    }

    const message = await twilioClient.messages.create({
      body,
      from: fromNumber,
      to: formattedPhone,
    });

    return { success: true, sid: message.sid };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Twilio SMS error:", msg);
    return { success: false, error: msg };
  }
}
