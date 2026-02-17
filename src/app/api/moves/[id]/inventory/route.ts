import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = user.email.trim().toLowerCase();
    const { data: move } = await supabase
      .from("moves")
      .select("id, client_email")
      .eq("id", moveId)
      .ilike("client_email", email)
      .single();

    if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

    // Use admin client so RLS on move_inventory doesn't block; we already verified move belongs to this client
    const admin = createAdminClient();
    const { data: items, error } = await admin
      .from("move_inventory")
      .select("id, room, item_name, status, box_number, sort_order")
      .eq("move_id", moveId)
      .order("room")
      .order("sort_order")
      .order("item_name");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ items: items ?? [] });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch inventory" },
      { status: 500 }
    );
  }
}
