import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;

  try {
    const supabase = await createClient();
    const { data: invoices, error } = await supabase
      .from("invoices")
      .select("id, invoice_number, client_name, amount, move_id, due_date, status, file_path, organization_id")
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ invoices: invoices ?? [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
