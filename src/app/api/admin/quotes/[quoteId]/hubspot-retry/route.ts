import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireStaff } from "@/lib/api-auth"
import { getEmailBaseUrl } from "@/lib/email-base-url"
import { autoCreateHubSpotDealForSentQuote } from "@/lib/hubspot/auto-create-deal-for-quote"
import { resolveHubSpotPipelineId } from "@/lib/hubspot/hubspot-pipeline"
import { resolveHubSpotStageInternalId } from "@/lib/hubspot/resolve-hubspot-stage-id"
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage"
import { quoteRowEligibleForHubSpotDeal } from "@/lib/quotes/hubspot-quote-eligibility"

/**
 * Manually create or link a HubSpot deal for a quote that was sent without a linked deal.
 * Staff only. Does not send email.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ quoteId: string }> }) {
  const { error: authErr } = await requireStaff()
  if (authErr) return authErr

  const { quoteId: rawId } = await ctx.params
  const quoteId = (rawId || "").trim()
  if (!quoteId) {
    return NextResponse.json({ success: false, code: "BAD_REQUEST", message: "Quote id is required" }, { status: 400 })
  }

  const sb = createAdminClient()
  const { data: quote, error: qErr } = await sb
    .from("quotes")
    .select("*, contacts:contact_id(name, email, phone)")
    .eq("quote_id", quoteId)
    .single()

  if (qErr || !quote) {
    return NextResponse.json({ success: false, code: "NOT_FOUND", message: "Quote not found" }, { status: 404 })
  }

  const existing = typeof (quote as { hubspot_deal_id?: string | null }).hubspot_deal_id === "string"
    ? (quote as { hubspot_deal_id: string }).hubspot_deal_id.trim()
    : ""
  if (existing) {
    return NextResponse.json({ success: true, dealId: existing, alreadyLinked: true })
  }

  if (!(quote as { sent_at?: string | null }).sent_at) {
    return NextResponse.json(
      {
        success: false,
        code: "NOT_SENT",
        message: "Send the quote first. HubSpot deals are created when a quote is sent with integration enabled.",
      },
      { status: 400 },
    )
  }

  if (!quoteRowEligibleForHubSpotDeal(quote as Record<string, unknown>)) {
    return NextResponse.json(
      {
        success: false,
        code: "NOT_ELIGIBLE",
        message: "Sample or training quotes are not synced to HubSpot.",
      },
      { status: 400 },
    )
  }

  if (!process.env.HUBSPOT_ACCESS_TOKEN) {
    return NextResponse.json(
      {
        success: false,
        code: "NO_TOKEN",
        message: "HubSpot token is not configured on the server. Add HUBSPOT_ACCESS_TOKEN to the deployment environment.",
      },
      { status: 503 },
    )
  }

  const pipelineId = await resolveHubSpotPipelineId(sb)
  if (!pipelineId) {
    return NextResponse.json(
      {
        success: false,
        code: "NO_PIPELINE",
        message: "Set the deals pipeline in Platform Settings under App, HubSpot (hubspot_pipeline_id).",
      },
      { status: 503 },
    )
  }

  const stageId = await resolveHubSpotStageInternalId(sb, "quote_sent")
  if (!stageId) {
    return NextResponse.json(
      {
        success: false,
        code: "NO_STAGE",
        message: "Set the Quote sent stage in Platform Settings under App, HubSpot (hubspot_stage_quote_sent).",
      },
      { status: 503 },
    )
  }

  const contact = quote.contacts as { name?: string | null; email?: string | null; phone?: string | null } | null
  const clientEmail = (contact?.email?.trim() || "").toLowerCase()
  if (!clientEmail) {
    return NextResponse.json(
      {
        success: false,
        code: "NO_EMAIL",
        message: "This quote has no contact email. Add an email on the contact, then try again.",
      },
      { status: 400 },
    )
  }

  const fullName = (contact?.name?.trim() || "").trim()
  const firstName = fullName ? fullName.split(/\s+/)[0]! : ""
  const lastName = fullName ? fullName.split(/\s+/).slice(1).join(" ").trim() : ""
  const baseUrl = getEmailBaseUrl()
  const quoteUrl = `${baseUrl}/quote/${quoteId}`

  const created = await autoCreateHubSpotDealForSentQuote({
    sb,
    quote: quote as Record<string, unknown>,
    quoteIdText: quoteId,
    quoteUrl,
    clientEmail,
    firstName,
    lastName,
    clientPhone: contact?.phone ?? null,
  })

  if (!created?.dealId) {
    return NextResponse.json(
      {
        success: false,
        code: "CREATE_FAILED",
        message:
          "HubSpot did not create a deal. Check server logs for the HubSpot response. Common causes: invalid deal properties in HubSpot, expired token, or API permissions.",
      },
      { status: 502 },
    )
  }

  await sb.from("quotes").update({ hubspot_deal_id: created.dealId }).eq("quote_id", quoteId)

  const status = String((quote as { status?: string }).status || "").toLowerCase()
  const trigger = status === "viewed" ? "viewed" : "quote_sent"
  await syncDealStage(created.dealId, trigger).catch(() => {})

  return NextResponse.json({ success: true, dealId: created.dealId })
}
