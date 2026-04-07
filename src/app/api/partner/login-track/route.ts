import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type PartnerRow = {
  id: string;
  first_login_at: string | null;
  last_login_at: string | null;
  login_count: number | null;
  password_changed: boolean | null;
  portal_welcome_completed_at: string | null;
  organizations: { onboarding_status: string | null } | { onboarding_status: string | null }[] | null;
};

function orgStatusFromRow(pu: PartnerRow): boolean {
  const raw = pu.organizations;
  const o = Array.isArray(raw) ? raw[0] : raw;
  return (o?.onboarding_status ?? "").toLowerCase() === "active";
}

function jsonForPartner(pu: PartnerRow) {
  return {
    isFirstLogin: !pu.first_login_at,
    passwordChanged: pu.password_changed ?? false,
    loginCount: pu.login_count || 0,
    lastLoginAt: pu.last_login_at,
    orgOnboardingActive: orgStatusFromRow(pu),
    portalWelcomeCompleted: !!pu.portal_welcome_completed_at,
  };
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: pu, error: selErr } = await supabase
    .from("partner_users")
    .select(
      `
      id,
      first_login_at,
      last_login_at,
      login_count,
      password_changed,
      portal_welcome_completed_at,
      organizations ( onboarding_status )
    `,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!pu) {
    return NextResponse.json(
      { error: selErr?.message || "Not a partner" },
      { status: 403 },
    );
  }

  const row = pu as unknown as PartnerRow;
  const isFirstLogin = !row.first_login_at;
  const now = new Date().toISOString();

  const admin = createAdminClient();
  const { error: upErr } = await admin
    .from("partner_users")
    .update({
      first_login_at: row.first_login_at || now,
      last_login_at: now,
      login_count: (row.login_count || 0) + 1,
    })
    .eq("id", row.id);

  if (upErr) {
    console.error("partner login-track update", upErr);
  }

  return NextResponse.json({
    ...jsonForPartner(row),
    isFirstLogin,
    loginCount: (row.login_count || 0) + 1,
    lastLoginAt: row.last_login_at,
  });
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: pu, error: selErr } = await supabase
    .from("partner_users")
    .select(
      `
      id,
      first_login_at,
      last_login_at,
      login_count,
      password_changed,
      portal_welcome_completed_at,
      organizations ( onboarding_status )
    `,
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!pu) {
    return NextResponse.json(
      { error: selErr?.message || "Not a partner" },
      { status: 403 },
    );
  }

  return NextResponse.json(jsonForPartner(pu as unknown as PartnerRow));
}
