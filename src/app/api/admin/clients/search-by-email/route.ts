import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/**
 * POST /api/admin/clients/search-by-email
 *
 * Body: { email: string }
 *
 * Returns the first matching contact record (quote client) from OPS+, plus
 * their most recent move for context.  Used by the quote form to surface
 * returning clients and prevent duplicate contact creation.
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { email } = await req.json().catch(() => ({}));

  if (!email || typeof email !== "string") {
    return NextResponse.json({ client: null, prev_move: null });
  }

  const admin = createAdminClient();
  const emailTrimmed = email.trim().toLowerCase();

  const { data: contact } = await admin
    .from("contacts")
    .select("id, name, email, phone, hubspot_contact_id, square_customer_id, square_card_id")
    .eq("email", emailTrimmed)
    .limit(1)
    .maybeSingle();

  if (!contact) {
    return NextResponse.json({ client: null, prev_move: null });
  }

  // Look up the most recent completed move for this contact
  const { data: prevMove } = await admin
    .from("moves")
    .select("move_number, move_date, move_size, from_address, to_address")
    .eq("contact_id", contact.id)
    .order("move_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    client: {
      id: contact.id,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      hubspot_contact_id: contact.hubspot_contact_id,
      square_customer_id: contact.square_customer_id,
      square_card_id: contact.square_card_id,
    },
    prev_move: prevMove
      ? {
          move_number: prevMove.move_number,
          move_date: prevMove.move_date,
          move_size: prevMove.move_size,
          from_address: prevMove.from_address,
          to_address: prevMove.to_address,
        }
      : null,
  });
}
