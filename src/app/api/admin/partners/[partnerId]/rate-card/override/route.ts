import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/auth/check-role";

// POST — upsert an override
export async function POST(req: NextRequest, { params }: { params: Promise<{ partnerId: string }> }) {
  const { error: authErr } = await requireSuperAdmin();
  if (authErr) return authErr;

  const db = createAdminClient();
  const { partnerId } = await params;
  const body = await req.json();
  const { rate_table, rate_record_id, override_field, override_value, is_locked, notes } = body;

  if (!rate_table || !rate_record_id || !override_field || override_value === undefined) {
    return NextResponse.json({ error: "rate_table, rate_record_id, override_field, override_value required" }, { status: 400 });
  }

  const { data, error } = await db
    .from("partner_rate_overrides")
    .upsert(
      {
        partner_id: partnerId,
        rate_table,
        rate_record_id,
        override_field,
        override_value,
        is_locked: is_locked ?? false,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "partner_id,rate_table,rate_record_id,override_field" }
    )
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, override: data });
}

// DELETE — remove an override (reset to template rate)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ partnerId: string }> }) {
  const { error: authErr } = await requireSuperAdmin();
  if (authErr) return authErr;

  const db = createAdminClient();
  const { partnerId } = await params;
  const body = await req.json();
  const { override_id, rate_table, rate_record_id, override_field } = body;

  let query = db.from("partner_rate_overrides").delete().eq("partner_id", partnerId);

  if (override_id) {
    query = query.eq("id", override_id);
  } else if (rate_table && rate_record_id && override_field) {
    query = query.eq("rate_table", rate_table).eq("rate_record_id", rate_record_id).eq("override_field", override_field);
  } else {
    return NextResponse.json({ error: "Provide override_id or (rate_table + rate_record_id + override_field)" }, { status: 400 });
  }

  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
