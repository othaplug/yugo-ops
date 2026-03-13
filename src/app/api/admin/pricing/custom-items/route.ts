import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/check-role";

export interface CustomItemUsage {
  item_name: string;
  weight_used: number;
  times_used: number;
  first_used: string;
  last_used: string;
}

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  try {
    const supabase = createAdminClient();

    const { data: masterNames } = await supabase
      .from("item_weights")
      .select("item_name")
      .eq("active", true);
    const masterSet = new Set((masterNames || []).map((r) => String(r.item_name).trim().toLowerCase()));

    const { data: dismissedRaw } = await supabase
      .from("platform_config")
      .select("value")
      .eq("key", "dismissed_custom_items")
      .single();
    const dismissed = new Set<string>(
      dismissedRaw?.value ? (JSON.parse(dismissedRaw.value as string) as string[]) : []
    );

    const agg = new Map<
      string,
      { display_name: string; weight_used: number; times_used: number; first_used: string; last_used: string }
    >();

    const addItem = (
      name: string,
      weight: number,
      usedAt: string
    ) => {
      const n = String(name).trim();
      if (!n) return;
      const key = n.toLowerCase();
      if (masterSet.has(key) || dismissed.has(key)) return;
      const w = typeof weight === "number" ? weight : 1;
      const existing = agg.get(key);
      if (existing) {
        existing.times_used += 1;
        existing.weight_used = w;
        if (usedAt < existing.first_used) existing.first_used = usedAt;
        if (usedAt > existing.last_used) existing.last_used = usedAt;
      } else {
        agg.set(key, { display_name: n, weight_used: w, times_used: 1, first_used: usedAt, last_used: usedAt });
      }
    };

    const { data: quotes } = await supabase
      .from("quotes")
      .select("inventory_items, created_at")
      .not("inventory_items", "is", null);
    for (const q of quotes || []) {
      const items = (q.inventory_items as { slug?: string; name?: string; quantity?: number; weight_score?: number }[]) || [];
      const usedAt = (q.created_at as string) || "";
      for (const it of items) {
        const name = it.name || it.slug || "";
        if (!name) continue;
        const qty = it.quantity ?? 1;
        const weight = it.weight_score ?? 1;
        for (let i = 0; i < qty; i++) addItem(name, weight, usedAt);
      }
    }

    const { data: moves } = await supabase
      .from("moves")
      .select("items, created_at")
      .not("items", "is", null);
    for (const m of moves || []) {
      const items = (m.items as { name?: string; quantity?: number; weight_score?: number }[]) || [];
      const usedAt = (m.created_at as string) || "";
      for (const it of items) {
        const name = it.name || "";
        if (!name) continue;
        const qty = it.quantity ?? 1;
        const weight = it.weight_score ?? 1;
        for (let i = 0; i < qty; i++) addItem(name, weight, usedAt);
      }
    }

    const result: CustomItemUsage[] = Array.from(agg.entries())
      .map(([, v]) => ({
        item_name: v.display_name,
        weight_used: v.weight_used,
        times_used: v.times_used,
        first_used: v.first_used,
        last_used: v.last_used,
      }))
      .sort((a, b) => b.times_used - a.times_used);

    return NextResponse.json({ data: result });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const action = body.action as string;
    const supabase = createAdminClient();

    if (action === "add_to_master") {
      const itemName = (body.item_name as string)?.trim();
      const weightScore = Number(body.weight_score) || 1;
      const category = (body.category as string)?.trim() || "furniture";
      const room = (body.room as string)?.trim() || "other";
      const isCommon = !!body.is_common;
      const slug =
        (body.slug as string)?.trim() ||
        itemName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
      if (!itemName || !slug) {
        return NextResponse.json({ error: "Item name required" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("item_weights")
        .insert({
          item_name: itemName,
          slug: slug || `custom-${Date.now()}`,
          weight_score: weightScore,
          category,
          room,
          is_common: isCommon,
          display_order: 9999,
          active: true,
        })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ data });
    }

    if (action === "dismiss") {
      const itemName = (body.item_name as string)?.trim()?.toLowerCase();
      if (!itemName) return NextResponse.json({ error: "Item name required" }, { status: 400 });
      const { data: existing } = await supabase
        .from("platform_config")
        .select("id, value")
        .eq("key", "dismissed_custom_items")
        .single();
      const current: string[] = existing?.value ? JSON.parse(existing.value as string) : [];
      if (current.includes(itemName)) return NextResponse.json({ ok: true });
      const updated = [...current, itemName];
      if (existing?.id) {
        await supabase
          .from("platform_config")
          .update({ value: JSON.stringify(updated) })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("platform_config")
          .insert({
            key: "dismissed_custom_items",
            value: JSON.stringify(updated),
            description: "Custom item names dismissed from review list",
          });
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
