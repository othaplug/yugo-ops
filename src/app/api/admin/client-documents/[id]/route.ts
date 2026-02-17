import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("id")
      .eq("user_id", (await supabase.auth.getUser()).data.user?.id)
      .single();

    if (!platformUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: doc } = await supabase
      .from("client_documents")
      .select("storage_path")
      .eq("id", id)
      .single();

    if (doc?.storage_path) {
      await supabase.storage.from("client-documents").remove([doc.storage_path]);
    }

    const { error } = await supabase.from("client_documents").delete().eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete" },
      { status: 500 }
    );
  }
}
