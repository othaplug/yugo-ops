import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/check-role";
import {
  QUOTE_RESIDENTIAL_TIER_FEATURES_KEY,
  QUOTE_RESIDENTIAL_TIER_META_OVERRIDES_KEY,
} from "@/lib/quotes/residential-tier-quote-display";
import { TIER_ORDER } from "@/app/quote/[quoteId]/quote-shared";

const TIER_KEYS = TIER_ORDER as unknown as readonly string[];
import { invalidateConfigCache } from "@/lib/config";

function validateTierFeaturesJson(raw: string): { ok: true } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "Tier features: invalid JSON" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Tier features: expected a JSON object" };
  }
  const p = parsed as Record<string, unknown>;
  for (const key of Object.keys(p)) {
    if (!TIER_KEYS.includes(key)) {
      return { ok: false, error: `Tier features: unknown tier key "${key}"` };
    }
  }
  for (const tier of TIER_ORDER) {
    if (!(tier in p)) continue;
    const arr = p[tier];
    if (!Array.isArray(arr)) {
      return { ok: false, error: `Tier features: "${tier}" must be an array` };
    }
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return { ok: false, error: `Tier features: invalid row at ${tier}[${i}]` };
      }
      const o = item as Record<string, unknown>;
      if (
        typeof o.card !== "string" ||
        typeof o.title !== "string" ||
        typeof o.desc !== "string" ||
        typeof o.iconName !== "string"
      ) {
        return { ok: false, error: `Tier features: ${tier}[${i}] needs card, title, desc, iconName (strings)` };
      }
    }
    if (arr.length > 0 && arr.length < 3) {
      return { ok: false, error: `Tier features: "${tier}" needs at least 3 rows when provided` };
    }
  }
  return { ok: true };
}

function validateMetaOverridesJson(raw: string): { ok: true } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: "Tier meta: invalid JSON" };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Tier meta: expected a JSON object" };
  }
  const p = parsed as Record<string, unknown>;
  for (const key of Object.keys(p)) {
    if (!TIER_KEYS.includes(key)) {
      return { ok: false, error: `Tier meta: unknown tier key "${key}"` };
    }
  }
  for (const tier of TIER_ORDER) {
    if (!(tier in p)) continue;
    const block = p[tier];
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      return { ok: false, error: `Tier meta: "${tier}" must be an object` };
    }
    const b = block as Record<string, unknown>;
    if (b.tagline !== undefined && typeof b.tagline !== "string") {
      return { ok: false, error: `Tier meta: ${tier}.tagline must be a string` };
    }
    if (b.footer !== undefined && typeof b.footer !== "string") {
      return { ok: false, error: `Tier meta: ${tier}.footer must be a string` };
    }
  }
  return { ok: true };
}

export async function GET() {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("platform_config")
      .select("key, value")
      .in("key", [QUOTE_RESIDENTIAL_TIER_FEATURES_KEY, QUOTE_RESIDENTIAL_TIER_META_OVERRIDES_KEY]);
    const map: Record<string, string> = {};
    for (const row of data ?? []) map[row.key] = row.value ?? "";
    return NextResponse.json({
      tierFeaturesJson: map[QUOTE_RESIDENTIAL_TIER_FEATURES_KEY] ?? "",
      tierMetaOverridesJson: map[QUOTE_RESIDENTIAL_TIER_META_OVERRIDES_KEY] ?? "",
    });
  } catch (e) {
    console.error("[quote-display-config] GET", e);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;
  try {
    const body = (await req.json()) as { tierFeaturesJson?: unknown; tierMetaOverridesJson?: unknown };
    const tierFeaturesJson = typeof body.tierFeaturesJson === "string" ? body.tierFeaturesJson : "";
    const tierMetaOverridesJson = typeof body.tierMetaOverridesJson === "string" ? body.tierMetaOverridesJson : "";

    const vf = validateTierFeaturesJson(tierFeaturesJson);
    if (!vf.ok) return NextResponse.json({ error: vf.error }, { status: 400 });
    const vm = validateMetaOverridesJson(tierMetaOverridesJson);
    if (!vm.ok) return NextResponse.json({ error: vm.error }, { status: 400 });

    const db = createAdminClient();
    await db.from("platform_config").upsert(
      [
        { key: QUOTE_RESIDENTIAL_TIER_FEATURES_KEY, value: tierFeaturesJson.trim() },
        { key: QUOTE_RESIDENTIAL_TIER_META_OVERRIDES_KEY, value: tierMetaOverridesJson.trim() },
      ],
      { onConflict: "key" },
    );

    invalidateConfigCache();

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[quote-display-config] PATCH", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
