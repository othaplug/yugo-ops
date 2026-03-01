import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pu } = await supabase
    .from("partner_users")
    .select("first_login_at, last_login_at, login_count, password_changed")
    .eq("user_id", user.id)
    .single();

  if (!pu) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  const isFirstLogin = !pu.first_login_at;
  const now = new Date().toISOString();

  await supabase
    .from("partner_users")
    .update({
      first_login_at: pu.first_login_at || now,
      last_login_at: now,
      login_count: (pu.login_count || 0) + 1,
    })
    .eq("user_id", user.id);

  return NextResponse.json({
    isFirstLogin,
    passwordChanged: pu.password_changed ?? false,
    loginCount: (pu.login_count || 0) + 1,
    lastLoginAt: pu.last_login_at,
  });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: pu } = await supabase
    .from("partner_users")
    .select("first_login_at, last_login_at, login_count, password_changed")
    .eq("user_id", user.id)
    .single();

  if (!pu) return NextResponse.json({ error: "Not a partner" }, { status: 403 });

  return NextResponse.json({
    isFirstLogin: !pu.first_login_at,
    passwordChanged: pu.password_changed ?? false,
    loginCount: pu.login_count || 0,
    lastLoginAt: pu.last_login_at,
  });
}
