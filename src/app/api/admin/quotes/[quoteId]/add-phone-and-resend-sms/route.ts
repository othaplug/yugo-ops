import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { sendQuoteLinkSms } from "@/lib/quote-sms";
import { normalizePhone } from "@/lib/phone";

/**
 * Capture a missing phone number on a quote's contact and immediately
 * fire the quote-link SMS. Used by the "Phone missing — SMS won't
 * send" banner on the quote detail page so a coordinator can close
 * the loop without leaving the page.
 *
 * Body: { phone: string }
 * Returns: { ok: true, phone } on success, or { ok: false, error } on failure.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { quoteId } = await params;
  let body: { phone?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const phone = normalizePhone(String(body.phone ?? ""));
  if (!phone || phone.length < 10) {
    return NextResponse.json(
      { error: "Enter a valid phone number (10+ digits)." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { data: q, error: qErr } = await admin
    .from("quotes")
    .select(
      "id, quote_id, contact_id, service_type, factors_applied, contacts:contact_id(id, name, email, phone)",
    )
    .eq("quote_id", quoteId)
    .maybeSingle();
  if (qErr || !q) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  const contactId = (q as { contact_id?: string }).contact_id;
  if (!contactId) {
    return NextResponse.json(
      { error: "This quote has no linked contact." },
      { status: 400 },
    );
  }

  const { error: upErr } = await admin
    .from("contacts")
    .update({ phone })
    .eq("id", contactId);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const contact = Array.isArray(q.contacts) ? q.contacts[0] : q.contacts;
  const firstName = String(contact?.name ?? "").split(/\s+/)[0] || "there";
  const factors = (q.factors_applied ?? {}) as Record<string, unknown>;
  const smsResult = await sendQuoteLinkSms({
    phone,
    quoteId: q.quote_id as string,
    firstName,
    serviceType: q.service_type as string,
    eventName: (factors.event_name as string) ?? null,
  });

  if (!smsResult.ok) {
    return NextResponse.json(
      {
        ok: false,
        phone,
        error: `Phone saved, but SMS did not send: ${smsResult.skipped ?? "unknown reason"}`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, phone });
}
