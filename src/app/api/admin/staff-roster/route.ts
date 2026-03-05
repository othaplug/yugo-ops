import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/check-role";

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

  if (updates.is_active === false) {
    updates.deactivated_at = new Date().toISOString();
  } else if (updates.is_active === true) {
    updates.deactivated_at = null;
  }
  updates.updated_at = new Date().toISOString();

  const sb = createAdminClient();
  const { data, error } = await sb
    .from("staff_roster")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
