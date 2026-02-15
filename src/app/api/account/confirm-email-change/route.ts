import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const { code, newEmail } = await req.json();
    const codeStr = typeof code === "string" ? code.trim() : "";
    const newEmailTrimmed = typeof newEmail === "string" ? newEmail.trim().toLowerCase() : "";
    if (!codeStr || !newEmailTrimmed) {
      return NextResponse.json({ error: "Code and new email are required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient();
    const { data: row } = await admin
      .from("email_verification_codes")
      .select("id, new_email")
      .eq("user_id", user.id)
      .eq("purpose", "email_change")
      .eq("new_email", newEmailTrimmed)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row || row.new_email !== newEmailTrimmed) {
      return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
    }

    // Verify code matches (compare without timing attack in production you'd use crypto.timingSafeEqual)
    const { data: fullRow } = await admin
      .from("email_verification_codes")
      .select("code")
      .eq("id", row.id)
      .single();
    if (!fullRow || fullRow.code !== codeStr) {
      return NextResponse.json({ error: "Invalid code" }, { status: 400 });
    }

    // Update auth user email
    const { error: updateError } = await admin.auth.admin.updateUserById(user.id, {
      email: newEmailTrimmed,
    });
    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // Update platform_users
    await admin.from("platform_users").update({
      email: newEmailTrimmed,
      updated_at: new Date().toISOString(),
    }).eq("user_id", user.id);

    // Delete used code
    await admin.from("email_verification_codes").delete().eq("id", row.id);

    // Sign out current session
    await supabase.auth.signOut();

    return NextResponse.json({ ok: true, message: "Email updated. Please sign in with your new email." });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update email" },
      { status: 500 }
    );
  }
}
