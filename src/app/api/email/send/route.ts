import { NextRequest, NextResponse } from "next/server";
import { resend } from "@/lib/resend";

export async function POST(req: NextRequest) {
  try {
    const { to, subject, html } = await req.json();

    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === "re_your_api_key_here") {
      console.log("[Email skipped — no Resend API key]", { to, subject });
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { data, error } = await resend.emails.send({
      from: "OPS+ <notifications@opsplus.co>",
      to,
      subject,
      html,
    });

    if (error) throw error;
    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}