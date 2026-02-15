import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("user_id")
      .eq("user_id", user.id)
      .single();
    if (!platformUser) return NextResponse.json({ error: "Platform users only" }, { status: 403 });

    const admin = createAdminClient();
    await admin.from("platform_users").update({
      two_factor_enabled: true,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    return NextResponse.json({ ok: true, message: "2FA enabled. A code will be sent to your email on each login." });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to enable 2FA" },
      { status: 500 }
    );
  }
}
