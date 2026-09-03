import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Public analytics beacon. Unauthenticated by design (client-side telemetry),
 * so it must be bounded: without a rate limit or size cap an attacker could
 * bloat analytics_events or poison the data with huge/arbitrary payloads.
 * Rate-limited per IP (generous — beacons fire on page views/clicks), the event
 * name is length-capped, and the properties JSON is size-capped.
 */
const MAX_EVENT_LEN = 120;
const MAX_PROPERTIES_BYTES = 4096;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (!rateLimit(`analytics-event:${ip}`, 120, 60_000).allowed) {
      // Fire-and-forget contract: return 200 so the client never retries/loops.
      return NextResponse.json({ ok: true });
    }

    const { event, properties, timestamp } = await req.json();

    if (!event || typeof event !== "string" || event.length > MAX_EVENT_LEN) {
      return NextResponse.json({ ok: true });
    }

    // Reject oversized property blobs (storage-bloat / poisoning guard).
    let safeProps: unknown = {};
    if (properties && typeof properties === "object") {
      const encoded = JSON.stringify(properties);
      if (encoded.length <= MAX_PROPERTIES_BYTES) safeProps = properties;
    }

    const db = createAdminClient();
    await db
      .from("analytics_events")
      .insert({
        event,
        properties: safeProps,
        timestamp: timestamp || new Date().toISOString(),
      })
      .then(undefined, () => {});

    return NextResponse.json({ ok: true });
  } catch {
    // Fire-and-forget: always return 200
    return NextResponse.json({ ok: true });
  }
}
