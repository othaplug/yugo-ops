import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, TemplateName } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";
import { requireStaff } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";

const SERVICE_TO_TEMPLATE: Record<string, string> = {
  local_move: "quote-residential",
  long_distance: "quote-longdistance",
  office_move: "quote-office",
  single_item: "quote-singleitem",
  white_glove: "quote-whiteglove",
  specialty: "quote-specialty",
  b2b_oneoff: "quote-specialty",
  b2b_delivery: "quote-specialty",
};

/** Subject for all quote emails: "FirstName, Your Move Quote is Here - QuoteID" */
function quoteSubject(firstName: string, quoteId: string): string {
  const namePart = firstName ? `${firstName}, ` : "";
  return `${namePart}Your Move Quote is Here - ${quoteId}`;
}

export async function POST(req: NextRequest) {
  try {
    const { user, error: authError } = await requireStaff();
    if (authError) return authError;

    const rl = rateLimit(`quote-send:${user!.id}`, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const quoteId = (body.quoteId ?? body.quote_id) as string | undefined;
    const hubspotDealId = body.hubspot_deal_id ?? body.hubspotDealId;
    const bodyEmail = (body.email ?? body.client_email) as string | undefined;
    const bodyClientName = (body.client_name ?? body.clientName) as string | undefined;

    if (!quoteId || typeof quoteId !== "string") {
      return NextResponse.json({ error: "quoteId is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: quote, error: qErr } = await supabase
      .from("quotes")
      .select("*, contacts:contact_id(name, email, phone)")
      .eq("quote_id", quoteId)
      .single();

    if (qErr || !quote) {
      return NextResponse.json(
        { error: "Quote not found", detail: qErr?.message },
        { status: 404 },
      );
    }

    const contact = quote.contacts as {
      name: string;
      email: string | null;
      phone: string | null;
    } | null;

    // Use contact email from DB when present; otherwise use email from request body (form input)
    const clientEmail = (contact?.email?.trim() || bodyEmail?.trim()) || null;
    if (!clientEmail) {
      return NextResponse.json({ error: "Contact has no email address. Enter the client email in the form and try again." }, { status: 400 });
    }

    const fullName = (contact?.name?.trim() || bodyClientName?.trim()) || "";
    const firstName = fullName ? fullName.split(/\s+/)[0]!.trim() : "";
    const serviceType = quote.service_type as string;
    const template = SERVICE_TO_TEMPLATE[serviceType];
    if (!template) {
      return NextResponse.json(
        { error: `Unknown service_type: ${serviceType}` },
        { status: 400 },
      );
    }

    const baseUrl = getEmailBaseUrl();
    const quoteUrl = `${baseUrl}/quote/${quoteId}`;

    const factors = (quote.factors_applied ?? {}) as Record<string, unknown>;

    const { data: coordConfig } = await supabase
      .from("platform_config")
      .select("key, value")
      .in("key", ["coordinator_name", "coordinator_phone", "quote_expiry_days"]);

    const coordinatorName = coordConfig?.find((c) => c.key === "coordinator_name")?.value || null;
    const coordinatorPhone = coordConfig?.find((c) => c.key === "coordinator_phone")?.value || null;
    const expiryDays = parseInt(coordConfig?.find((c) => c.key === "quote_expiry_days")?.value || "7", 10);

    const subject = quoteSubject(firstName, quoteId);

    const result = await sendEmail({
      to: clientEmail,
      subject,
      template: template as TemplateName,
      data: {
        clientName: firstName,
        quoteId,
        quoteUrl,
        serviceType,
        expiresAt: quote.expires_at ?? null,
        fromAddress: quote.from_address,
        toAddress: quote.to_address,
        moveDate: quote.move_date,
        moveSize: quote.move_size ?? null,
        companyName: (factors.company_name as string) ?? null,
        itemDescription: (factors.item_description as string) ?? null,
        itemCategory: (factors.item_category as string) ?? null,
        projectType: (factors.project_type as string) ?? null,
        distance: factors.distance_km ? `${factors.distance_km} km` : null,
        tiers: quote.tiers ?? null,
        customPrice: quote.custom_price ? Number(quote.custom_price) : null,
        coordinatorName,
        coordinatorPhone,
        recommendedTier: quote.recommended_tier ?? "signature",
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to send email", detail: result.error },
        { status: 500 },
      );
    }

    const now = new Date();
    await supabase
      .from("quotes")
      .update({
        status: "sent",
        sent_at: now.toISOString(),
        quote_url: quoteUrl,
        expires_at: new Date(now.getTime() + expiryDays * 86_400_000).toISOString(),
      })
      .eq("quote_id", quoteId);

    // Persist the email (and name) we sent to on the contact so moves created from this quote
    // (e.g. via recover-move) get client_email and referral codes work.
    if (quote.contact_id && clientEmail) {
      const contactUpdate: { email: string; name?: string } = { email: clientEmail.trim() };
      if (fullName.trim()) contactUpdate.name = fullName.trim();
      await supabase
        .from("contacts")
        .update(contactUpdate)
        .eq("id", quote.contact_id);
    }

    const dealIdRaw = hubspotDealId ?? quote.hubspot_deal_id;
    const dealId = typeof dealIdRaw === "string" ? dealIdRaw : null;
    if (dealId) {
      const token = process.env.HUBSPOT_ACCESS_TOKEN;
      if (token) {
        const curatedPrice =
          (quote.tiers as Record<string, { price: number }> | null)?.curated?.price ??
          (quote.tiers as Record<string, { price: number }> | null)?.essentials?.price ??
          quote.custom_price;

        const fullName = (contact?.name?.trim() || bodyClientName?.trim()) || "";
        const first = fullName ? fullName.split(/\s+/)[0]!.trim() : "";
        const last = fullName ? fullName.split(/\s+/).slice(1).join(" ").trim() : "";

        const dealProps: Record<string, string> = {
          quote_url: quoteUrl,
        };
        if (curatedPrice != null) dealProps.amount = String(curatedPrice);
        if (first) dealProps.firstname = first;
        if (last) dealProps.lastname = last;
        if (quote.from_address?.trim()) dealProps.pick_up_address = quote.from_address.trim();
        if (quote.to_address?.trim()) dealProps.drop_off_address = quote.to_address.trim();
        if (quote.from_access?.trim()) dealProps.access_from = quote.from_access.trim();
        if (quote.to_access?.trim()) dealProps.access_to = quote.to_access.trim();
        if (quote.service_type?.trim()) dealProps.service_type = quote.service_type.trim();
        if (quote.move_size?.trim()) dealProps.move_size = quote.move_size.trim();
        if (quote.move_date?.trim()) dealProps.move_date = quote.move_date.trim();

        fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ properties: dealProps }),
        }).catch(() => {});

        syncDealStage(dealId, "quote_sent").catch(() => {});
      }
    }

    logAudit({
      userId: user?.id,
      userEmail: user?.email,
      action: "send_quote",
      resourceType: "quote",
      resourceId: quoteId,
      details: { method: body.method ?? "email" },
    });

    return NextResponse.json({ success: true, emailId: result.id });
  } catch (err) {
    console.error("[quotes/send]", err);
    return NextResponse.json(
      { error: "Internal error", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
