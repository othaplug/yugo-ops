import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

export async function GET() {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("organizations")
      .select("id, name, type, contact_name, email, phone, created_at")
      .not("type", "eq", "b2c")
      .order("name");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ partners: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch B2B partners" },
      { status: 500 }
    );
  }
}
