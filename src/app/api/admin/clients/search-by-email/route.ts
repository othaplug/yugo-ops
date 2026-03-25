import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { normalizePhone } from "@/lib/phone";

/**
 * POST /api/admin/clients/search-by-email
 *
 * Body: { email?: string, phone?: string }
 *
 * Returns the first matching contact record (quote client) from OPS+, plus
 * their most recent move for context.  Used by the quote form to surface
 * returning clients and prevent duplicate contact creation.
 * Email is tried first when both are provided.
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { email, phone } = await req.json().catch(() => ({}));

  const emailTrimmed = typeof email === "string" ? email.trim().toLowerCase() : "";
  const phoneNorm = typeof phone === "string" ? normalizePhone(phone) : "";

  if (!emailTrimmed && phoneNorm.length !== 10) {
    return NextResponse.json({ client: null, prev_move: null });
  }

  const admin = createAdminClient();

  const select =
    "id, name, email, phone, hubspot_contact_id, square_customer_id, square_card_id" as const;

  let contact: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    hubspot_contact_id: string | null;
    square_customer_id: string | null;
    square_card_id: string | null;
  } | null = null;

  if (emailTrimmed) {
    const { data } = await admin.from("contacts").select(select).eq("email", emailTrimmed).limit(1).maybeSingle();
    contact = data;
  }
  if (!contact && phoneNorm.length === 10) {
    const { data } = await admin.from("contacts").select(select).eq("phone", phoneNorm).limit(1).maybeSingle();
    contact = data;
  }

  if (!contact) {
    return NextResponse.json({ client: null, prev_move: null });
  }

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
