import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashCrewPin } from "@/lib/crew-token";
import { clearLockout } from "@/lib/crew-lockout";

/** POST: Reset crew member PIN (admin only) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
