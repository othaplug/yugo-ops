import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { getFeatureConfig } from "@/lib/platform-settings";
import { logActivity } from "@/lib/activity";

const LEGACY_EVENTS = new Set([
  "quote_viewed",
  "tier_selected",
  "addon_toggled",
  "contract_started",
  "contract_signed",
  "payment_started",
  "quote_abandoned",
]);

const ENGAGEMENT_EVENTS = new Set([
  "page_view",
  "tier_clicked",
  "tier_hovered",
  "addon_toggled",
  "contract_viewed",
  "payment_started",
  "payment_abandoned",
  "comparison_viewed",
  "call_crew_clicked",
  "page_exit",
]);

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = rateLimit(`qt:${ip}`, 60, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = await req.json();
    const {
      quote_id,
      event_type,
      metadata,
      event_data,
      session_duration_seconds,
      device_type,
    } = body as {
      quote_id?: string;
      event_type?: string;
      metadata?: Record<string, unknown>;
      event_data?: Record<string, unknown>;
      session_duration_seconds?: number;
      device_type?: string;
    };

    if (!quote_id || !event_type) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const cfg = await getFeatureConfig(["quote_engagement_tracking"]);
    const trackingEnabled = cfg.quote_engagement_tracking === "true";

    if (LEGACY_EVENTS.has(event_type)) {
      await supabase.from("quote_events").insert({
        quote_id,
        event_type,
        metadata: metadata ?? event_data ?? {},
      });
    }

    if (trackingEnabled && ENGAGEMENT_EVENTS.has(event_type)) {
      const { data: quoteRow } = await supabase
        .from("quotes")
        .select("id")
        .eq("quote_id", quote_id)
        .single();

      if (quoteRow) {
        await supabase.from("quote_engagement").insert({
          quote_id: quoteRow.id,
          event_type,
          event_data: event_data ?? metadata ?? {},
          session_duration_seconds: session_duration_seconds ?? null,
          device_type: device_type ?? null,
        });
      }
    }

    // Feed notable client engagement events to the admin activity feed
    const activityMap: Record<string, { description: string; icon: "quote" | "pen" | "payment" | "mail" }> = {
      quote_viewed:     { description: `Quote viewed by client — ${quote_id}`, icon: "quote" },
      tier_selected:    { description: `Client selected a tier — ${quote_id}${metadata?.tier ? ` (${metadata.tier})` : ""}`, icon: "quote" },
      contract_started: { description: `Client started contract — ${quote_id}`, icon: "pen" },
      contract_signed:  { description: `Contract signed by client — ${quote_id}`, icon: "pen" },
      payment_started:  { description: `Client started payment — ${quote_id}`, icon: "payment" },
    };
    const activityEntry = activityMap[event_type];
    if (activityEntry) {
      await logActivity({
        entity_type: "quote",
        entity_id: quote_id,
        event_type,
        description: activityEntry.description,
        icon: activityEntry.icon,
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
