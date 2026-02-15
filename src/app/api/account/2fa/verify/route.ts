import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    const codeStr = typeof code === "string" ? code.trim() : "";
    if (!codeStr) return NextResponse.json({ error: "Code is required" }, { status: 400 });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: row } = await admin
      .from("email_verification_codes")
      .select("id, code")
      .eq("user_id", user.id)
      .eq("purpose", "2fa")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row || row.code !== codeStr) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    await admin.from("email_verification_codes").delete().eq("id", row.id);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to verify" },
      { status: 500 }
    );
  }
}
