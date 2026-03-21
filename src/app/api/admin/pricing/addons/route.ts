import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/check-role";

export async function GET() {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("addons")
      .select("*")
      .order("display_order", { ascending: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  try {
    const { rows } = await req.json();
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const supabase = createAdminClient();
    for (const row of rows) {
      if (row.id) {
        const { id, created_at: _ca, ...rest } = row;
        rest.updated_at = new Date().toISOString();
        const { error } = await supabase.from("addons").update(rest).eq("id", id);
        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  try {
    const { row } = await req.json();
    if (!row) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const supabase = createAdminClient();
    const { id: _id, ...insertData } = row;
    const { data, error } = await supabase.from("addons").insert(insertData).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("addons")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  try {
    const { order } = await req.json();
    if (!Array.isArray(order)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

    const supabase = createAdminClient();
    for (let i = 0; i < order.length; i++) {
      await supabase.from("addons").update({ display_order: i, updated_at: new Date().toISOString() }).eq("id", order[i]);
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
