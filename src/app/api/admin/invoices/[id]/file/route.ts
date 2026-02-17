import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  _req: NextRequest,
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

    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("file_path")
      .eq("id", id)
      .single();

    if (error || !invoice?.file_path) {
      return NextResponse.json({ error: "No file" }, { status: 404 });
    }

    const { data: signed } = await supabase.storage
      .from("invoice-files")
      .createSignedUrl(invoice.file_path, 3600);

    if (!signed?.signedUrl) return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
    return NextResponse.json({ url: signed.signedUrl });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
