import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/check-role";
import { invalidateConfigCache, getConfig } from "@/lib/config";
import {
  DISPLAY_DATE_FORMAT_CONFIG_KEY,
  DISPLAY_DATE_LOCALE_LEGACY_KEY,
  normalizeDisplayDateFormatPreset,
  resolveStoredDateFormat,
} from "@/lib/display-date-format";

export async function GET() {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;
  try {
    const formatRaw = await getConfig(DISPLAY_DATE_FORMAT_CONFIG_KEY, "");
    const legacyLocale = await getConfig(DISPLAY_DATE_LOCALE_LEGACY_KEY, "en-US");
    const preset = resolveStoredDateFormat(formatRaw, legacyLocale);
    return NextResponse.json({ preset: normalizeDisplayDateFormatPreset(preset) });
  } catch (e) {
    console.error("[display-date-format] GET error:", e);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;
  try {
    const body = (await req.json()) as { preset?: string };
    const preset = normalizeDisplayDateFormatPreset(body.preset);
    const admin = createAdminClient();
    const { error } = await admin.from("platform_config").upsert(
      { key: DISPLAY_DATE_FORMAT_CONFIG_KEY, value: preset },
      { onConflict: "key" },
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    invalidateConfigCache();
    return NextResponse.json({ preset });
  } catch (e) {
    console.error("[display-date-format] PATCH error:", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
