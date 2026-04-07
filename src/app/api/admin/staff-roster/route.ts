import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";
import { normalizePhone } from "@/lib/phone";

function normStaffName(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * When a staff roster display name changes, keep teams (`crews.members`) and Crew Portal
 * (`crew_members.name`) in sync — they are keyed by name string, not staff UUID.
 */
async function cascadeStaffNameChange(
  admin: ReturnType<typeof createAdminClient>,
  oldName: string,
  newName: string,
  staffPhone: string | null,
): Promise<void> {
  const oldN = normStaffName(oldName);
  const newTrimmed = newName.trim();
  if (!oldN || !newTrimmed || oldN === normStaffName(newTrimmed)) return;

  const staffDigits =
    staffPhone && normalizePhone(staffPhone).length >= 10 ? normalizePhone(staffPhone) : "";

  const { data: allCrews } = await admin.from("crews").select("id, members");
  for (const c of allCrews || []) {
    const raw = c.members;
    if (!Array.isArray(raw)) continue;
    let changed = false;
    const next = raw.map((m: unknown) => {
      const s = typeof m === "string" ? m.trim() : String(m ?? "").trim();
      if (normStaffName(s) === oldN) {
        changed = true;
        return newTrimmed;
      }
      return typeof m === "string" ? m : String(m);
    });
    if (changed) {
      const { error: uerr } = await admin
        .from("crews")
        .update({ members: next as string[], updated_at: new Date().toISOString() })
        .eq("id", c.id);
      if (uerr) console.error("[staff-roster PATCH] cascade crews", c.id, uerr);
    }
  }

  const { data: portalRows } = await admin.from("crew_members").select("id, name, phone");
  const candidates = (portalRows || []).filter((row) => normStaffName(String(row.name ?? "")) === oldN);
  const now = new Date().toISOString();

  let toUpdate: { id: string }[] = [];
  if (staffDigits) {
    const phoneMatch = candidates.filter(
      (r) => normalizePhone(String(r.phone ?? "")) === staffDigits,
    );
    if (phoneMatch.length > 0) {
      toUpdate = phoneMatch;
    } else if (candidates.length === 1) {
      toUpdate = candidates;
    }
  } else {
    toUpdate = candidates;
  }

  for (const row of toUpdate) {
    const { error: cmErr } = await admin
      .from("crew_members")
      .update({ name: newTrimmed, updated_at: now })
      .eq("id", row.id);
    if (cmErr) console.error("[staff-roster PATCH] cascade crew_members", row.id, cmErr);
  }
}

export async function GET() {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("staff_roster")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  const body = await req.json();
  const name = (body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("staff_roster")
    .insert({
      name,
      role: body.role ?? "mover",
      phone: body.phone ?? null,
      email: body.email ?? null,
      notes: body.notes ?? null,
      hourly_rate: body.hourly_rate ?? 25,
      specialties: body.specialties ?? null,
      hire_date: body.hire_date ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A staff member with that name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const sb = createAdminClient();
  const { data: existing, error: existingErr } = await sb
    .from("staff_roster")
    .select("id, name, phone")
    .eq("id", id)
    .single();
  if (existingErr || !existing) {
    return NextResponse.json({ error: "Staff not found" }, { status: 404 });
  }

  const oldName = typeof existing.name === "string" ? existing.name.trim() : "";
  const nameChanged =
    typeof updates.name === "string" &&
    oldName.toLowerCase() !== String(updates.name).trim().toLowerCase();

  if (typeof updates.name === "string") {
    updates.name = updates.name.trim();
  }

  if (updates.is_active === false) {
    updates.deactivated_at = new Date().toISOString();
  } else if (updates.is_active === true) {
    updates.deactivated_at = null;
  }
  updates.updated_at = new Date().toISOString();

  const { data, error } = await sb
    .from("staff_roster")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (nameChanged && typeof data?.name === "string") {
    const phone =
      typeof data.phone === "string" && data.phone.trim()
        ? data.phone
        : typeof existing.phone === "string" && existing.phone.trim()
          ? existing.phone
          : null;
    await cascadeStaffNameChange(sb, oldName, data.name, phone);
  }

  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const { error: authErr } = await requireRole("owner");
  if (authErr) return authErr;

  const body = await req.json();
  const { id } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const sb = createAdminClient();
  const { error } = await sb.from("staff_roster").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
