import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

export async function GET() {
  const { user, error: authErr } = await requireAuth();
  if (authErr) return authErr;
  try {
    const supabase = await createClient();
    const { data: partnerUser } = await supabase
      .from("partner_users")
      .select("org_id")
      .eq("user_id", user!.id)
      .single();

    if (!partnerUser) {
      return NextResponse.json({ error: "Not a partner" }, { status: 403 });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, type, contact_name, email, phone")
      .eq("id", partnerUser.org_id)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json(org);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const { user, error: authErr } = await requireAuth();
  if (authErr) return authErr;
  try {
    const supabase = await createClient();
    const { data: partnerUser } = await supabase
      .from("partner_users")
      .select("org_id")
      .eq("user_id", user!.id)
      .single();

    if (!partnerUser) {
      return NextResponse.json({ error: "Not a partner" }, { status: 403 });
    }

    const body = await req.json();
    const updates: Record<string, string> = {};

    if (typeof body.contact_name === "string") updates.contact_name = body.contact_name.trim();
    if (typeof body.email === "string") updates.email = body.email.trim().toLowerCase();
    if (typeof body.phone === "string") updates.phone = body.phone.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { error } = await supabase
      .from("organizations")
      .update(updates)
      .eq("id", partnerUser.org_id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update profile" },
      { status: 500 }
    );
  }
}
