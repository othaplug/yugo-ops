import { Resend } from "resend";

export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key || key === "re_your_api_key_here") {
    throw new Error("RESEND_API_KEY is not configured. Add it to your environment variables.");
  }
  return new Resend(key);
}
