import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, TemplateName } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";
import { requireStaff } from "@/lib/api-auth";
import { rateLimit } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { logActivity } from "@/lib/activity";
import { getCompanyDisplayName } from "@/lib/config";
import { sendQuoteLinkSms } from "@/lib/quote-sms";
import { updateLeadAfterQuoteSent } from "@/lib/leads/update-from-quote";
import { pickupLocationsFromQuote, dropoffLocationsFromQuote } from "@/lib/quotes/quote-address-display";
import { normalizePhone } from "@/lib/phone";

const SERVICE_TO_TEMPLATE: Record<string, string> = {
  local_move: "quote-residential",
  long_distance: "quote-longdistance",
  office_move: "quote-office",
  single_item: "quote-singleitem",
  white_glove: "quote-whiteglove",
  specialty: "quote-specialty",
  b2b_oneoff: "quote-b2boneoff",
  b2b_delivery: "quote-b2boneoff",
  event: "quote-event",
  labour_only: "quote-labouronly",
  bin_rental: "quote-binrental",
};

const SERVICE_SUBJECT: Record<string, string> = {
  local_move: "Your Move Quote is Ready",
  long_distance: "Your Long Distance Move Quote",
  office_move: "Your Office Move Quote",
  single_item: "Your Delivery Quote",
  white_glove: "Your White Glove Service Quote",
  specialty: "Your Specialty Move Quote",
  b2b_oneoff: "Your Delivery Quote",
  b2b_delivery: "Your Delivery Quote",
  event: "Your Event Logistics Quote",
  labour_only: "Your Service Quote",
  bin_rental: "Your Yugo Bin Rental Quote",
};

function quoteSubject(
  firstName: string,
  quoteId: string,
  serviceType: string,
  eventName?: string | null,
): string {
  const namePart = firstName ? `${firstName}, ` : "";
  if (serviceType === "event" && eventName?.trim()) {
    return `${namePart}Your Yugo Event Quote, ${eventName.trim()} (${quoteId})`;
  }
  if (serviceType === "bin_rental") {
    return `${namePart}Your Yugo Bin Rental Quote (${quoteId})`;
  }
  const subjectBase = SERVICE_SUBJECT[serviceType] ?? "Your Quote is Ready";
  return `${namePart}${subjectBase} ${quoteId}`;
}

function fmtEmailDay(dateStr: string | null | undefined): string {
  if (!dateStr) return "To be confirmed";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
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
    const bodyPhoneRaw = (body.phone ?? body.client_phone) as string | undefined;
    const bodyClientName = (body.client_name ?? body.clientName) as string | undefined;
    const leadIdRaw = body.lead_id ?? body.leadId;
    const leadId = typeof leadIdRaw === "string" && leadIdRaw.length > 0 ? leadIdRaw : undefined;

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

    const clientEmail = (contact?.email?.trim() || bodyEmail?.trim()) || null;
    if (!clientEmail) {
      return NextResponse.json({ error: "Contact has no email address. Enter the client email in the form and try again." }, { status: 400 });
    }

    const phoneFromBody = bodyPhoneRaw?.trim() ? normalizePhone(bodyPhoneRaw) : "";
    const phoneFromContact = contact?.phone?.trim() ? normalizePhone(contact.phone) : "";
    const clientPhone = (phoneFromBody || phoneFromContact) || null;

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
    const pickupLocations = pickupLocationsFromQuote(factors, quote.from_address, quote.from_access);
    const dropoffLocations = dropoffLocationsFromQuote(factors, quote.to_address, quote.to_access);

    const binLineItemsRaw = Array.isArray(factors.bin_line_items)
      ? (factors.bin_line_items as { label?: string; amount?: number }[])
      : [];
    const binLineItems =
      binLineItemsRaw.length > 0
        ? binLineItemsRaw
            .filter((x) => x.label && typeof x.amount === "number")
            .map((x) => ({ label: String(x.label), amount: Number(x.amount) }))
        : null;

    let binIncludeLines: string[] | null = null;
    if (serviceType === "bin_rental") {
      const n = Math.floor(Number(factors.bin_count_total) || 0);
      const w = Math.floor(Number(factors.bin_wardrobe_boxes) || 0);
      const lines: string[] = [];
      if (n > 0) lines.push(`${n} plastic bins (27×16×13")`);
      if (w > 0) lines.push(`${w} wardrobe boxes (provided on move day)`);
      lines.push("Zip ties (1 per bin)");
      if (factors.bin_packing_paper === true) lines.push("Packing paper");
      if (factors.bin_material_delivery_charged === true) {
        lines.push("Material delivery");
      } else if (factors.bin_linked_move_id) {
        lines.push("Delivery included with your Yugo move");
      }
      binIncludeLines = lines;
    }

    const { data: coordConfig } = await supabase
      .from("platform_config")
      .select("key, value")
      .in("key", ["coordinator_name", "coordinator_phone", "quote_expiry_days"]);

    const coordinatorName = coordConfig?.find((c) => c.key === "coordinator_name")?.value || null;
    const coordinatorPhone = coordConfig?.find((c) => c.key === "coordinator_phone")?.value || null;
    const expiryDays = parseInt(coordConfig?.find((c) => c.key === "quote_expiry_days")?.value || "7", 10);

    const eventNameForSubject = (factors.event_name as string) ?? null;
    const subject = quoteSubject(firstName, quoteId, serviceType, eventNameForSubject);
    const platformCompanyName = await getCompanyDisplayName();

    const storedMoveSize = (quote.move_size as string | null) ?? null;
    const inventoryScore = (quote.inventory_score as number | null) ?? (factors.inventory_score as number | null) ?? null;
    const inventoryItems = (quote.inventory_items as { quantity?: number }[] | null) ?? [];
    const itemCount = Array.isArray(inventoryItems) ? inventoryItems.reduce((s, i) => s + (i.quantity ?? 1), 0) : 0;
    const suggests2br = (inventoryScore != null && inventoryScore >= 28) || itemCount >= 14;
    const moveSize =
      storedMoveSize === "1br" && suggests2br ? "2br" : storedMoveSize;

    if (storedMoveSize === "1br" && suggests2br) {
      await supabase.from("quotes").update({ move_size: "2br" }).eq("quote_id", quoteId);
    }

    type EventLegEmailRow = {
      label: string;
      deliveryDay: string;
      returnDay: string;
      origin: string;
      venue: string;
      crewLine: string;
      delivery: number;
      ret: number;
      legSubtotal: number;
    };
    let eventLegBlocks: EventLegEmailRow[] | undefined;
    if (serviceType === "event") {
      const isEvMulti = factors.event_mode === "multi" && Array.isArray(factors.event_legs);
      const truckLbl = quote.truck_primary ? String(quote.truck_primary) : "Sprinter";
      if (isEvMulti) {
        const legs = factors.event_legs as Array<Record<string, unknown>>;
        eventLegBlocks = legs.map((leg) => {
          const del = Number(leg.delivery_charge ?? 0);
          const ret = Number(leg.return_charge ?? 0);
          return {
            label: String(leg.label ?? "Event"),
            deliveryDay: fmtEmailDay(leg.delivery_date as string),
            returnDay: fmtEmailDay(leg.return_date as string),
            origin: String(leg.from_address ?? quote.from_address ?? ""),
            venue: String(leg.to_address ?? ""),
            crewLine: `${leg.event_crew ?? quote.est_crew_size ?? 2} movers · ${truckLbl}`,
            delivery: del,
            ret,
            legSubtotal: del + ret,
          };
        });
      } else {
        const del = Number(factors.delivery_charge ?? 0);
        const ret = Number(factors.return_charge ?? 0);
        eventLegBlocks = [
          {
            label: ((factors.event_name as string) || "Event").trim(),
            deliveryDay: fmtEmailDay(quote.move_date),
            returnDay: fmtEmailDay((factors.return_date as string) ?? quote.move_date),
            origin: String(quote.from_address ?? ""),
            venue: String(quote.to_address ?? ""),
            crewLine: `${quote.est_crew_size ?? factors.event_crew ?? 2} movers · ${truckLbl}`,
            delivery: del,
            ret,
            legSubtotal: del + ret,
          },
        ];
      }
    }

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
        fromAccess: quote.from_access ?? null,
        toAccess: quote.to_access ?? null,
        pickupLocations,
        dropoffLocations,
        moveDate: quote.move_date,
        moveSize,
        companyName: (factors.company_name as string) ?? platformCompanyName,
        itemDescription: (factors.item_description as string) ?? null,
        itemCategory: (factors.item_category as string) ?? null,
        projectType: (factors.project_type as string) ?? null,
        distance: factors.distance_km ? `${factors.distance_km} km` : null,
        estCrewSize: quote.est_crew_size != null ? Number(quote.est_crew_size) : null,
        estHours: quote.est_hours != null ? Number(quote.est_hours) : null,
        truckSize: quote.truck_primary ? String(quote.truck_primary) : null,
        tiers: quote.tiers ?? null,
        customPrice: quote.custom_price ? Number(quote.custom_price) : null,
        coordinatorName,
        coordinatorPhone,
        recommendedTier: quote.recommended_tier ?? "signature",
        // Event
        eventName: (factors.event_name as string) ?? null,
        eventReturnDate: (factors.return_date as string) ?? null,
        eventDeliveryCharge: (factors.delivery_charge as number) ?? null,
        eventSetupFee: (factors.setup_fee as number) ?? null,
        eventReturnCharge: (factors.return_charge as number) ?? null,
        eventLegBlocks,
        eventDeposit: quote.deposit_amount != null ? Number(quote.deposit_amount) : null,
        // Labour Only
        labourCrewSize: (factors.crew_size as number) ?? null,
        labourHours: (factors.hours as number) ?? null,
        labourRate: (factors.labour_rate as number) ?? null,
        labourVisits: (factors.visits as number) ?? null,
        labourDescription: (factors.labour_description as string) ?? null,
        // B2B One-Off
        b2bBusinessName: (factors.b2b_business_name as string) ?? null,
        b2bItems: Array.isArray(factors.b2b_items)
          ? (factors.b2b_items as string[]).join(", ")
          : null,
        binBundleLabel: (factors.bin_bundle_label as string) ?? null,
        binDropOffDate: (factors.bin_drop_off_date as string) ?? null,
        binPickupDate: (factors.bin_pickup_date as string) ?? null,
        binMoveDate: (factors.bin_move_date as string) ?? quote.move_date,
        binDeliveryAddress: quote.to_address ?? null,
        binPickupAddress: quote.from_address ?? null,
        binLineItems,
        binSubtotal:
          typeof factors.bin_subtotal === "number"
            ? factors.bin_subtotal
            : quote.custom_price != null
              ? Number(quote.custom_price)
              : null,
        binTax: typeof factors.bin_tax === "number" ? factors.bin_tax : null,
        binGrandTotal:
          typeof factors.bin_grand_total === "number"
            ? factors.bin_grand_total
            : quote.deposit_amount != null
              ? Number(quote.deposit_amount)
              : null,
        binIncludeLines,
      },
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Failed to send email", detail: result.error },
        { status: 500 },
      );
    }

    const smsResult = await sendQuoteLinkSms({
      phone: clientPhone,
      quoteId,
      firstName,
      serviceType,
      eventName: (factors.event_name as string) ?? null,
    });
    if (!smsResult.ok) {
      console.warn("[quotes/send] quote SMS failed:", smsResult.skipped);
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

    if (quote.contact_id && clientEmail) {
      const contactUpdate: { email: string; name?: string; phone?: string } = { email: clientEmail.trim() };
      if (fullName.trim()) contactUpdate.name = fullName.trim();
      if (phoneFromBody.length >= 10) {
        contactUpdate.phone = phoneFromBody;
      }
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
          (quote.tiers as Record<string, { price: number }> | null)?.essential?.price ??
          (quote.tiers as Record<string, { price: number }> | null)?.curated?.price ??
          (quote.tiers as Record<string, { price: number }> | null)?.essentials?.price ??
          quote.custom_price;

        const fName = fullName ? fullName.split(/\s+/)[0]!.trim() : "";
        const lName = fullName ? fullName.split(/\s+/).slice(1).join(" ").trim() : "";

        const dealProps: Record<string, string> = {
          quote_url: quoteUrl,
        };
        if (curatedPrice != null) dealProps.amount = String(curatedPrice);
        if (fName) dealProps.firstname = fName;
        if (lName) dealProps.lastname = lName;
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

    await logAudit({
      userId: user?.id,
      userEmail: user?.email,
      action: "send_quote",
      resourceType: "quote",
      resourceId: quoteId,
      details: { method: body.method ?? "email" },
    });

    await logActivity({
      entity_type: "quote",
      entity_id: quoteId,
      event_type: "sent",
      description: `Quote sent to ${fullName || clientEmail}, ${quoteId}`,
      icon: "mail",
    });

    if (leadId && quote.id) {
      await updateLeadAfterQuoteSent(supabase, {
        leadId,
        quoteUuid: quote.id as string,
        performedByUserId: user?.id ?? null,
      }).catch((e) => console.warn("[quotes/send] lead update:", e));
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
