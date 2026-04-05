import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/check-role";
import { invalidateConfigCache, getConfig } from "@/lib/config";
import {
  DISPLAY_DATE_LOCALE_CONFIG_KEY,
  normalizeDisplayDateLocale,
  type DisplayDateLocale,
} from "@/lib/display-date-locale";

export async function GET() {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;
  try {
    const raw = await getConfig(DISPLAY_DATE_LOCALE_CONFIG_KEY, "en-US");
    const locale = normalizeDisplayDateLocale(raw);
    return NextResponse.json({ locale });
  } catch (e) {
    console.error("[display-date-locale] GET error:", e);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;
  try {
    const body = (await req.json()) as { locale?: string };
    const locale = normalizeDisplayDateLocale(body.locale) as DisplayDateLocale;
    const admin = createAdminClient();
    const { error } = await admin.from("platform_config").upsert(
      { key: DISPLAY_DATE_LOCALE_CONFIG_KEY, value: locale },
      { onConflict: "key" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateConfigCache();
    return NextResponse.json({ locale });
  } catch (e) {
    console.error("[display-date-locale] PATCH error:", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
