import { NextRequest, NextResponse } from "next/server";
import { twilioClient } from "@/lib/twilio";

export async function POST(req: NextRequest) {
  try {
    const { to, body } = await req.json();

    if (!process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID === "your_account_sid") {
      console.log("[SMS skipped — no Twilio credentials]", { to, body });
      return NextResponse.json({ ok: true, skipped: true });
    }

    const message = await twilioClient.messages.create({
      to,
      from: process.env.TWILIO_PHONE_NUMBER,
      body,
    });

    return NextResponse.json({ ok: true, sid: message.sid });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}