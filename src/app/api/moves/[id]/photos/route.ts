import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

    const { data: photos, error } = await supabase
      .from("move_photos")
      .select("id, storage_path, caption, sort_order")
      .eq("move_id", moveId)
      .order("sort_order")
      .order("created_at");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const bucket = "move-photos";
    const urls: { id: string; url: string; caption: string | null }[] = [];
    for (const p of photos ?? []) {
      const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(p.storage_path, 3600);
      urls.push({ id: p.id, url: signed?.signedUrl ?? "", caption: p.caption });
    }

    return NextResponse.json({ photos: urls });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch photos" },
      { status: 500 }
    );
  }
}
