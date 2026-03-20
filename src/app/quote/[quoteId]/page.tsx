import { createAdminClient } from "@/lib/supabase/admin";
import { isFeatureEnabled } from "@/lib/platform-settings";
import { getLegalBranding } from "@/lib/legal-branding";
import type { TierFeature } from "./quote-shared";
import QuotePageClient from "./QuotePageClient";
import QuoteExpired from "./QuoteExpired";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  return { title: `Quote ${quoteId}` };
}

export default async function QuotePage({ params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  // Use admin client so the quote is found by link regardless of RLS (anon can only see sent/viewed/accepted).
  const admin = createAdminClient();
  const { data: quote, error } = await admin
    .from("quotes")
    .select("*")
    .eq("quote_id", quoteId)
    .single();

  if (error || !quote) {
    return <QuoteExpired quoteId={quoteId} reason="not_found" />;
  }

  const isExpired = quote.expires_at && new Date(quote.expires_at) < new Date();
  if (isExpired && quote.status !== "accepted") {
    return <QuoteExpired quoteId={quoteId} reason="expired" expiresAt={quote.expires_at} />;
  }

  // Mark as viewed + record event (server-side, fire-and-forget)
  if (quote.status === "draft" || quote.status === "sent") {
    admin
      .from("quotes")
      .update({ status: "viewed", viewed_at: new Date().toISOString() })
      .eq("id", quote.id)
      .then(() => {});
    admin
      .from("quote_events")
      .insert({
        quote_id: quote.quote_id,
        event_type: "quote_viewed",
        metadata: { source: "server", service_type: quote.service_type },
      })
      .then(() => {});
    pushViewedNoteToHubSpot(quote.quote_id, quote.hubspot_deal_id);
  }

  // Fetch contact, add-ons, crew count, move count, and valuation data in parallel
  const [contactResult, addonsResult, crewCountResult, moveDateCountResult, valTiersResult, valUpgradesResult, eventFeatResult] =
    await Promise.all([
    quote.contact_id
      ? admin.from("contacts").select("email").eq("id", quote.contact_id).single()
      : Promise.resolve({ data: null }),
    admin
      .from("addons")
      .select("id, name, slug, description, price, price_type, unit_label, tiers, percent_value, applicable_service_types, excluded_tiers, is_popular, display_order")
      .eq("active", true)
      .order("display_order"),
    admin.from("crews").select("id", { count: "exact", head: true }).eq("active", true),
    quote.move_date
      ? admin
          .from("moves")
          .select("id", { count: "exact", head: true })
          .eq("scheduled_date", quote.move_date)
          .in("status", ["confirmed", "scheduled", "in_progress"])
      : Promise.resolve({ count: 0 }),
    admin.from("valuation_tiers").select("*").eq("active", true).order("tier_slug"),
    admin.from("valuation_upgrades").select("*").eq("active", true).eq("move_size", quote.move_size ?? "2br"),
    admin.from("platform_config").select("value").eq("key", "event_features").maybeSingle(),
  ]);

  const contactEmail = contactResult?.data?.email ?? null;
  const applicableAddons = (addonsResult?.data ?? []).filter((a) =>
    a.applicable_service_types?.includes(quote.service_type),
  );

  const totalCrews = crewCountResult?.count ?? 4;
  const movesOnDate = moveDateCountResult?.count ?? 0;
  const slotsRemaining = Math.max(0, totalCrews - movesOnDate);

  const valuationEnabled = await isFeatureEnabled("valuation_upgrades");
  const branding = await getLegalBranding();

  let eventFeatures: TierFeature[] | null = null;
  const rawEv = eventFeatResult?.data?.value;
  if (typeof rawEv === "string" && rawEv.trim()) {
    try {
      const parsed = JSON.parse(rawEv) as unknown;
      if (Array.isArray(parsed)) eventFeatures = parsed as TierFeature[];
    } catch {
      eventFeatures = null;
    }
  }

  return (
    <QuotePageClient
      quote={quote}
      addons={applicableAddons}
      contactEmail={contactEmail}
      slotsRemaining={slotsRemaining}
      valuationTiers={valuationEnabled ? (valTiersResult?.data ?? []) : []}
      valuationUpgrades={valuationEnabled ? (valUpgradesResult?.data ?? []) : []}
      branding={{ companyLegal: branding.companyLegal, brand: branding.brand }}
      eventFeatures={eventFeatures}
    />
  );
}

async function pushViewedNoteToHubSpot(
  quoteId: string,
  hubspotDealId: string | null | undefined,
) {
  if (!hubspotDealId) return;
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return;

  try {
    const timestamp = new Date().toISOString();
    const noteBody = `Quote ${quoteId} was viewed by the client at ${new Date(timestamp).toLocaleString("en-CA", { timeZone: "America/Toronto" })}.`;

    const noteRes = await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: { hs_timestamp: timestamp, hs_note_body: noteBody },
      }),
    });

    if (!noteRes.ok) return;
    const note = await noteRes.json();

    await fetch(
      `https://api.hubapi.com/crm/v3/objects/notes/${note.id}/associations/deals/${hubspotDealId}/214`,
      { method: "PUT", headers: { Authorization: `Bearer ${token}` } },
    ).catch(() => {});
  } catch {
    // never block page render
  }
}
