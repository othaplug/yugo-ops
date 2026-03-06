import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, TemplateName } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";
import { requireStaff } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";

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

const SERVICE_SUBJECTS: Record<string, (name: string, extra?: string) => string> = {
  local_move: (name) => `Your YUGO+ Moving Quote — ${name}`,
  long_distance: (name) => `Your Long Distance Quote — ${name}`,
  office_move: (_name, company) => `Relocation Proposal — ${company || "Your Office"}`,
  single_item: (_name, item) => `Your Delivery Quote — ${item || "Your Item"}`,
  white_glove: (name) => `Your White Glove Service Quote — ${name}`,
  specialty: (name) => `Your Specialty Service Proposal — ${name}`,
  b2b_oneoff: (name) => `Your Delivery Quote — ${name}`,
  b2b_delivery: (name) => `Your Delivery Quote — ${name}`,
};

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

    const clientName = (contact?.name?.trim() || bodyClientName?.trim()) || "";
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

    const subjectFn = SERVICE_SUBJECTS[serviceType] ?? ((n: string) => `Your YUGO+ Quote — ${n}`);
    const extraSubject =
      serviceType === "office_move"
        ? (factors.company_name as string) ?? ""
        : serviceType === "single_item"
          ? (factors.item_description as string) ?? ""
          : "";

    const subject = subjectFn(clientName, extraSubject);

    const result = await sendEmail({
      to: clientEmail,
      subject,
      template: template as TemplateName,
      data: {
        clientName,
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

    const dealIdRaw = hubspotDealId ?? quote.hubspot_deal_id;
    const dealId = typeof dealIdRaw === "string" ? dealIdRaw : null;
    if (dealId) {
      const token = process.env.HUBSPOT_ACCESS_TOKEN;
      if (token) {
        const essentialsPrice =
          (quote.tiers as Record<string, { price: number }> | null)?.essentials?.price ??
          quote.custom_price;

        fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            properties: {
              ...(essentialsPrice ? { amount: String(essentialsPrice) } : {}),
              quote_url: quoteUrl,
            },
          }),
        }).catch(() => {});

        syncDealStage(dealId, "quote_sent").catch(() => {});
      }
    }

    return NextResponse.json({ success: true, emailId: result.id });
  } catch (err) {
    console.error("[quotes/send]", err);
    return NextResponse.json(
      { error: "Internal error", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
