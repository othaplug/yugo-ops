/**
 * POST /api/quotes/[quoteId]/declarations
 *
 * Public, token-protected endpoint for the client to persist the list
 * of high-value items declared on the quote page (Fix #10 from the
 * client-quote-page audit).
 *
 * Authentication: the client quote page passes the row's
 * `public_action_token` (the same token used for the decline button and
 * other public quote actions). The endpoint compares constant-time and
 * rate-limits on the originating IP.
 *
 * Body shape (the client sends the entire declarations array — this
 * endpoint REPLACES the stored value, doesn't append, so add/remove
 * both work without coordination):
 *   {
 *     token: "<public_action_token>",
 *     declarations: [
 *       { item_name: "Steinway upright", declared_value: 18000, fee: 360 },
 *       ...
 *     ]
 *   }
 *
 * Returns: { ok: true, count: N }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";

type DeclarationIn = {
  item_name?: unknown;
  declared_value?: unknown;
  fee?: unknown;
};

type DeclarationOut = {
  item_name: string;
  declared_value: number;
  fee: number;
};

const MAX_DECLARATIONS = 25; // generous upper bound; prevents JSONB bloat
const MAX_NAME_LEN = 200;
const MIN_VALUE = 100;
const MAX_VALUE = 5_000_000;

function sanitise(raw: unknown): DeclarationOut[] {
  if (!Array.isArray(raw)) return [];
  const out: DeclarationOut[] = [];
  for (const row of raw.slice(0, MAX_DECLARATIONS)) {
    const r = (row ?? {}) as DeclarationIn;
    const name = String(r.item_name ?? "").trim().slice(0, MAX_NAME_LEN);
    const value = Number(r.declared_value);
    const fee = Number(r.fee);
    if (!name) continue;
    if (!Number.isFinite(value) || value < MIN_VALUE || value > MAX_VALUE) continue;
    out.push({
      item_name: name,
      declared_value: Math.round(value * 100) / 100,
      fee: Number.isFinite(fee) && fee >= 0 ? Math.round(fee * 100) / 100 : 0,
    });
  }
  return out;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = rateLimit(`qd:${ip}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { quoteId } = await params;

  let body: { token?: string; declarations?: unknown };
  try {
    body = (await req.json()) as { token?: string; declarations?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token = String(body.token ?? "").trim();
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 401 });
  }

  const db = createAdminClient();

  const { data: quote, error: lookupErr } = await db
    .from("quotes")
    .select("id, quote_id, public_action_token, status, expires_at")
    .or(`id.eq.${quoteId},quote_id.eq.${quoteId}`)
    .maybeSingle();
  if (lookupErr || !quote?.id) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  const expected = String(quote.public_action_token ?? "").trim();
  if (!expected || expected !== token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Refuse on expired or already-converted quotes — writing declarations
  // after booking has no path to the move and would just silently drift.
  if (quote.status === "expired" || quote.status === "declined") {
    return NextResponse.json(
      { error: `Cannot edit declarations on a ${quote.status} quote.` },
      { status: 400 },
    );
  }

  const cleaned = sanitise(body.declarations);

  const { error: updateErr } = await db
    .from("quotes")
    .update({ high_value_declarations: cleaned })
    .eq("id", quote.id);
  if (updateErr) {
    return NextResponse.json(
      { error: updateErr.message || "Could not save declarations" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, count: cleaned.length });
}
