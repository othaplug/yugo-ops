import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { clearLockout } from "@/lib/crew-lockout";

/** PATCH: Update crew member — revoke access (is_active: false) or set role (e.g. team lead) */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await requireStaff();
  if (authError) return authError;

  const { id } = await params;
  const body = await req.json();
  const is_active = body.is_active;
  const role = body.role;

  const admin = createAdminClient();

  if (typeof is_active === "boolean") {
    const { data: member } = await admin.from("crew_members").select("phone, team_id").eq("id", id).single();
    const { error } = await admin
      .from("crew_members")
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (is_active && member?.phone) await clearLockout(member.phone);
    return NextResponse.json({ ok: true });
  }

  if (role === "lead" || role === "specialist" || role === "driver") {
    const { data: member } = await admin.from("crew_members").select("team_id").eq("id", id).single();
    if (!member?.team_id) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    const { data: teammates } = await admin
      .from("crew_members")
      .select("id")
      .eq("team_id", member.team_id)
      .eq("is_active", true);
    const updates: Promise<unknown>[] = [];
    for (const t of teammates || []) {
      const newRole = t.id === id ? "lead" : "specialist";
      const q = admin.from("crew_members").update({ role: newRole, updated_at: new Date().toISOString() }).eq("id", t.id).select().single();
      updates.push(Promise.resolve(q));
    }
    await Promise.all(updates);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Provide is_active or role" }, { status: 400 });
}
