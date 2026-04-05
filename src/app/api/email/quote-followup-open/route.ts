import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 1×1 tracking pixel — marks a follow-up row as opened when the image loads.
 * Query: id = quote_followups.id, t = quotes.public_action_token
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  const token = req.nextUrl.searchParams.get("t")?.trim();
  if (!id || !token) {
    return transparentPixel();
  }

  try {
    const sb = createAdminClient();
    const { data: fu } = await sb
      .from("quote_followups")
      .select("id, quote_id")
      .eq("id", id)
      .maybeSingle();

    if (!fu?.quote_id) return transparentPixel();

    const { data: qu } = await sb
      .from("quotes")
      .select("public_action_token")
      .eq("id", fu.quote_id)
      .maybeSingle();

    if (qu?.public_action_token?.trim() !== token) {
      return transparentPixel();
    }

    await sb
      .from("quote_followups")
      .update({
        email_opened: true,
        email_opened_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("email_opened", false);
  } catch {
    /* non-critical */
  }

  return transparentPixel();
}

function transparentPixel(): NextResponse {
  const buf = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64",
  );
  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      "Content-Length": String(buf.length),
    },
  });
}
