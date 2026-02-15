import { Resend } from "resend";

export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "re_your_api_key_here") {
    throw new Error("RESEND_API_KEY is not configured. Add it to your environment variables.");
  }
  return new Resend(key);
}

/** @deprecated Use getResend() for request-time key. Kept for clients/create, referrals, etc. */
export const resend = new Resend(process.env.RESEND_API_KEY || "");