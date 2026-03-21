import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin";

  if (code) {
    const supabase = await createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    if (data?.user) {
      await logAudit({
        userId: data.user.id,
        userEmail: data.user.email,
        action: "login",
        resourceType: "system",
        details: { method: "code_exchange", next },
      });
    }
  }

  return NextResponse.redirect(new URL(next, request.url));
}