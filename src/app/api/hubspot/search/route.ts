import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { dedupeHubSpotContact } from "@/lib/hubspot/contact-search";

/**
 * POST /api/hubspot/search
 *
 * Body: { email?: string, phone?: string, company?: string, contact_name?: string }
 *
 * At least one meaningful criterion is required (valid email, 10-digit phone,
 * or company name, or company + contact name).
 *
 * Returns the best HubSpot contact match in priority order:
 * email → phone → company + contact name → company only.
 * Response: { contact: null | HubSpotContact, match_kind?: "email" | "phone" | "company_name" | "company" }
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  const phone = typeof body.phone === "string" ? body.phone : "";
  const company = typeof body.company === "string" ? body.company : "";
  const contact_name = typeof body.contact_name === "string" ? body.contact_name : "";

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ contact: null });

  try {
    const result = await dedupeHubSpotContact(token, { email, phone, company, contact_name });
    if (!result) return NextResponse.json({ contact: null });

    const { contact, match_kind } = result;
    return NextResponse.json({
      contact: {
        hubspot_id: contact.hubspot_id,
        first_name: contact.first_name,
        last_name: contact.last_name,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
        title: contact.title,
        lead_status: contact.lead_status,
        deal_ids: contact.deal_ids,
      },
      match_kind,
    });
  } catch {
    return NextResponse.json({ contact: null });
  }
}
