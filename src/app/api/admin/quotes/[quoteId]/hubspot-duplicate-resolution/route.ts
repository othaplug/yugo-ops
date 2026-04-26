import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { autoCreateHubSpotDealForSentQuote } from "@/lib/hubspot/auto-create-deal-for-quote";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";
import { quoteRowEligibleForHubSpotDeal } from "@/lib/quotes/hubspot-quote-eligibility";

type Body = {
  action: "link" | "create_new";
  /** Required when action is link and not using the flagged existing id */
  dealId?: string;
};

/**
 * Resolve HubSpot duplicate state on a quote: link an existing deal, or create a new one anyway.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ quoteId: string }> }) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { quoteId: rawId } = await ctx.params;
  const quoteId = (rawId || "").trim();
  if (!quoteId) {
    return NextResponse.json({ success: false, message: "Quote id is required" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action !== "link" && body.action !== "create_new") {
    return NextResponse.json({ success: false, message: "action must be link or create_new" }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: quote, error: qErr } = await sb
    .from("quotes")
    .select("*, contacts:contact_id(name, email, phone)")
    .eq("quote_id", quoteId)
    .single();

  if (qErr || !quote) {
    return NextResponse.json({ success: false, message: "Quote not found" }, { status: 404 });
  }

  if (!quoteRowEligibleForHubSpotDeal(quote as Record<string, unknown>)) {
    return NextResponse.json(
      { success: false, message: "This quote is not eligible for HubSpot sync." },
      { status: 400 },
    );
  }

  if (body.action === "link") {
    const dealId = (body.dealId || (quote as { hubspot_existing_deal_id?: string }).hubspot_existing_deal_id || "")
      .trim();
    if (!dealId) {
      return NextResponse.json(
        { success: false, message: "dealId is required to link (or set hubspot_existing_deal_id on the quote first)." },
        { status: 400 },
      );
    }
    await sb
      .from("quotes")
      .update({
        hubspot_deal_id: dealId,
        hubspot_duplicate_detected: false,
        hubspot_existing_deal_id: null,
        hubspot_existing_deal_name: null,
        hubspot_existing_deal_stage: null,
      })
      .eq("quote_id", quoteId);

    const status = String((quote as { status?: string }).status || "").toLowerCase();
    const trigger = status === "viewed" ? "viewed" : "quote_sent";
    await syncDealStage(dealId, trigger).catch(() => {});

    return NextResponse.json({ success: true, dealId, linked: true });
  }

  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    return NextResponse.json(
      { success: false, message: "HUBSPOT_ACCESS_TOKEN is not configured." },
      { status: 503 },
    );
  }

  const contact = quote.contacts as { name?: string | null; email?: string | null; phone?: string | null } | null;
  const clientEmail = (contact?.email?.trim() || "").toLowerCase();
  if (!clientEmail) {
    return NextResponse.json({ success: false, message: "Contact email is required." }, { status: 400 });
  }

  const fullName = (contact?.name?.trim() || "").trim();
  const firstName = fullName ? fullName.split(/\s+/)[0]! : "";
  const lastName = fullName ? fullName.split(/\s+/).slice(1).join(" ").trim() : "";
  const baseUrl = getEmailBaseUrl();
  const quoteUrl = `${baseUrl}/quote/${quoteId}`;

  await sb
    .from("quotes")
    .update({
      hubspot_duplicate_detected: false,
      hubspot_existing_deal_id: null,
      hubspot_existing_deal_name: null,
      hubspot_existing_deal_stage: null,
    })
    .eq("quote_id", quoteId);

  const created = await autoCreateHubSpotDealForSentQuote({
    sb,
    quote: quote as Record<string, unknown>,
    quoteIdText: quoteId,
    quoteUrl,
    clientEmail,
    firstName,
    lastName,
    clientPhone: contact?.phone ?? null,
    skipDuplicateCheck: true,
  });

  if (!created || created.status !== "created" || !created.dealId) {
    return NextResponse.json(
      { success: false, message: "HubSpot did not create a deal. Check server logs." },
      { status: 502 },
    );
  }

  await sb.from("quotes").update({ hubspot_deal_id: created.dealId }).eq("quote_id", quoteId);

  const status = String((quote as { status?: string }).status || "").toLowerCase();
  const trigger = status === "viewed" ? "viewed" : "quote_sent";
  await syncDealStage(created.dealId, trigger).catch(() => {});

  return NextResponse.json({ success: true, dealId: created.dealId, created: true });
}
