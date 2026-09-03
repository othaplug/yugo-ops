import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { hashCrewPin } from "@/lib/crew-token";
import { clearLockout } from "@/lib/crew-lockout";

/** POST: Reset crew member PIN (staff only) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Resetting a crew PIN + clearing the lockout is a credential operation: it
  // must be staff-gated, not merely logged-in. requireAuth (login only) let any
  // client/partner session — which are real Supabase users with no
  // platform_users row — take over a crew account.
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();
  const { pin } = body;
  if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
    return NextResponse.json({ error: "PIN must be 6 digits" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: member, error: fetchError } = await admin
    .from("crew_members")
    .select("phone")
    .eq("id", id)
    .single();

  const { error } = await admin
    .from("crew_members")
    .update({
      pin_hash: hashCrewPin(pin),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (member?.phone) await clearLockout(member.phone);
  return NextResponse.json({ ok: true });
}
