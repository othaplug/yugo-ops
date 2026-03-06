import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { requireStaff } from "@/lib/api-auth";

/**
 * POST /api/quotes/update
 *
 * Re-quotes by creating a new versioned quote record.
 * The original quote is marked 'superseded', and the new one gets
 * parent_quote_id + incremented version.
 */
export async function POST(req: Request) {
  try {
    const { error: authError } = await requireStaff();
    if (authError) return authError;

    const body = await req.json();
    const {
      originalQuoteId,
      newQuoteId,
      reason,
      sendToClient = true,
    } = body as {
      originalQuoteId: string;
      newQuoteId: string;
      reason?: string;
      sendToClient?: boolean;
    };

    if (!originalQuoteId || !newQuoteId) {
      return NextResponse.json({ error: "originalQuoteId and newQuoteId are required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    /* ── Fetch original quote ── */
    const { data: original, error: origErr } = await supabase
      .from("quotes")
      .select("*, contacts:contact_id(name, email)")
      .eq("quote_id", originalQuoteId)
      .single();

    if (origErr || !original) {
      return NextResponse.json({ error: "Original quote not found" }, { status: 404 });
    }

    /* ── Fetch new quote ── */
    const { data: newQuote, error: newErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("quote_id", newQuoteId)
      .single();

    if (newErr || !newQuote) {
      return NextResponse.json({ error: "New quote not found" }, { status: 404 });
    }

    const currentVersion = Number(original.version) || 1;

    /* ── Link new quote to parent + increment version ── */
    await supabase
      .from("quotes")
      .update({
        parent_quote_id: original.id,
        version: currentVersion + 1,
        hubspot_deal_id: original.hubspot_deal_id ?? newQuote.hubspot_deal_id,
        contact_id: original.contact_id ?? newQuote.contact_id,
      })
      .eq("quote_id", newQuoteId);

    /* ── Mark original as superseded ── */
    await supabase
      .from("quotes")
      .update({ status: "superseded", updated_at: new Date().toISOString() })
      .eq("quote_id", originalQuoteId);

    /* ── Build changes summary ── */
    const changes: string[] = [];
    if (original.move_date !== newQuote.move_date)
      changes.push(`Date: ${original.move_date || "TBD"} → ${newQuote.move_date || "TBD"}`);
    if (original.move_size !== newQuote.move_size && newQuote.move_size)
      changes.push(`Size: ${original.move_size || "—"} → ${newQuote.move_size}`);
    if (original.from_address !== newQuote.from_address)
      changes.push(`Origin updated`);
    if (original.to_address !== newQuote.to_address)
      changes.push(`Destination updated`);

    const oldPrice = original.tiers?.essentials?.price ?? original.custom_price;
    const newPrice = newQuote.tiers?.essentials?.price ?? newQuote.custom_price;
    if (oldPrice && newPrice && Number(oldPrice) !== Number(newPrice)) {
      changes.push(`Price: $${Number(oldPrice).toLocaleString()} → $${Number(newPrice).toLocaleString()}`);
    }
    if (reason) changes.push(reason);
    const changesSummary = changes.length > 0 ? changes.join("<br/>") : "Quote details updated.";

    /* ── HubSpot: update deal amount + add note ── */
    const dealId = original.hubspot_deal_id || newQuote.hubspot_deal_id;
    const hsToken = process.env.HUBSPOT_ACCESS_TOKEN;
    if (dealId && hsToken) {
      if (newPrice) {
        fetch(`https://api.hubapi.com/crm/v3/objects/deals/${dealId}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${hsToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            properties: {
              amount: String(newPrice),
              quote_url: `${getEmailBaseUrl()}/quote/${newQuoteId}`,
            },
          }),
        }).catch(() => {});
      }

      const noteBody = [
        `Quote re-generated (v${currentVersion} → v${currentVersion + 1}).`,
        oldPrice && newPrice ? `Original: $${Number(oldPrice).toLocaleString()}, Updated: $${Number(newPrice).toLocaleString()}.` : "",
        reason ? `Reason: ${reason}` : "",
      ]
        .filter(Boolean)
        .join(" ");

      fetch(`https://api.hubapi.com/crm/v3/objects/notes`, {
        method: "POST",
        headers: { Authorization: `Bearer ${hsToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          properties: { hs_note_body: noteBody, hs_timestamp: new Date().toISOString() },
          associations: [
            {
              to: { id: dealId },
              types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 214 }],
            },
          ],
        }),
      }).catch(() => {});
    }

    /* ── Send updated quote email ── */
    const contact = original.contacts as { name: string; email: string | null } | { name: string; email: string | null }[] | null;
    const contactObj = Array.isArray(contact) ? contact[0] ?? null : contact;
    const clientEmail = contactObj?.email;

    if (sendToClient && clientEmail) {
      const SERVICE_LABELS: Record<string, string> = {
        local_move: "Residential Move",
        long_distance: "Long Distance Move",
        office_move: "Office Relocation",
        single_item: "Single Item Delivery",
        white_glove: "White Glove Service",
        specialty: "Specialty Service",
      };

      const baseUrl = getEmailBaseUrl();
      const quoteUrl = `${baseUrl}/quote/${newQuoteId}`;

      sendEmail({
        to: clientEmail,
        subject: `Your updated YUGO+ quote is ready — ${contactObj?.name || ""}`,
        template: "quote-updated",
        data: {
          clientName: contactObj?.name || "",
          quoteUrl,
          serviceLabel: SERVICE_LABELS[newQuote.service_type] ?? newQuote.service_type,
          changesSummary,
        },
      }).catch((err) => console.error("[quotes/update] email failed:", err));

      await supabase
        .from("quotes")
        .update({ status: "sent", sent_at: new Date().toISOString(), quote_url: quoteUrl })
        .eq("quote_id", newQuoteId);
    }

    return NextResponse.json({
      success: true,
      newQuoteId,
      version: currentVersion + 1,
      changesSummary: changes,
    });
  } catch (e) {
    console.error("[quotes/update] unexpected error:", e);
    return NextResponse.json(
      { error: "An unexpected error occurred", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
