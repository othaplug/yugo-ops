import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { TWO_FA_TRUST_COOKIE } from "../verify/route";

/**
 * GET /api/account/2fa/status
 * Returns whether the current admin session has already completed 2FA
 * (trust cookie is valid) or needs to verify.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) return NextResponse.json({ trusted: false, needsVerify: false });

    const { data: platformUser } = await supabase
      .from("platform_users")
      .select("two_factor_enabled")
      .eq("user_id", user.id)
      .single();

    if (!platformUser?.two_factor_enabled) {
      return NextResponse.json({ trusted: true, needsVerify: false });
    }

    const cookieStore = await cookies();
    const trustCookie = cookieStore.get(TWO_FA_TRUST_COOKIE);
    const isTrusted = trustCookie?.value === user.id;

    return NextResponse.json({ trusted: isTrusted, needsVerify: !isTrusted });
  } catch {
    return NextResponse.json({ trusted: false, needsVerify: false });
  }
}
