import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { event, properties, timestamp } = await req.json();

    if (!event || typeof event !== "string") {
      return NextResponse.json({ ok: true });
    }

    const db = createAdminClient();
    await db
      .from("analytics_events")
      .insert({
        event,
        properties: properties ?? {},
        timestamp: timestamp || new Date().toISOString(),
      })
      .then(undefined, () => {});

    return NextResponse.json({ ok: true });
  } catch {
    // Fire-and-forget: always return 200
    return NextResponse.json({ ok: true });
  }
}
