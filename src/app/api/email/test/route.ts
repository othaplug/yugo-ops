import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

/**
 * Test endpoint to verify Resend is working.
 * POST /api/email/test with { "to": "your@email.com" }
 * Returns the full Resend response for debugging.
 */
export async function POST(req: NextRequest) {
  try {
    const { to } = await req.json();
    const email = typeof to === "string" ? to.trim() : null;

    if (!email) {
      return NextResponse.json({ error: "Missing 'to' email address" }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    const hasKey = !!apiKey && apiKey !== "re_your_api_key_here";

    if (!hasKey) {
      return NextResponse.json(
        {
          error: "RESEND_API_KEY is not configured",
          debug: {
            hasEnv: "RESEND_API_KEY" in process.env,
            keyLength: apiKey?.length ?? 0,
            keyPrefix: apiKey?.slice(0, 5) ?? "none",
          },
        },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: "OPS+ <notifications@opsplus.co>",
      to: email,
      subject: "OPS+ Test Email",
      html: `<p>If you received this, Resend is working correctly.</p>`,
    });

    if (error) {
      return NextResponse.json(
        {
          error: error.message,
          name: (error as { name?: string }).name,
          debug: { data, error: JSON.stringify(error) },
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Test email sent",
      id: data?.id,
      debug: { data },
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Unknown error",
        debug: String(err),
      },
      { status: 500 }
    );
  }
}
