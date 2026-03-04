import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_EVENTS = new Set([
  "quote_viewed",
  "tier_selected",
  "addon_toggled",
  "contract_started",
  "contract_signed",
  "payment_started",
  "quote_abandoned",
]);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { quote_id, event_type, metadata } = body as {
      quote_id?: string;
      event_type?: string;
      metadata?: Record<string, unknown>;
    };

    if (!quote_id || !event_type || !VALID_EVENTS.has(event_type)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { error } = await supabase.from("quote_events").insert({
      quote_id,
      event_type,
      metadata: metadata ?? {},
    });

    if (error) {
      console.error("[quote_events] insert failed:", error.message);
      return NextResponse.json({ error: "Failed to store event" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
