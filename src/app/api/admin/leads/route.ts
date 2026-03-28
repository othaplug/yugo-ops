import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import type { LeadSource } from "@/lib/leads/priority";
import { parseCaptureFormPayload } from "@/lib/leads/parse-capture-form";
import { parseRawInquiryText } from "@/lib/leads/parse-raw-inquiry";
import { createLeadFromParsedCapture } from "@/lib/leads/capture-handler";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { user, error } = await requireStaff();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const mine = searchParams.get("mine") === "1";
  const attention = searchParams.get("attention") === "1";
  const orderAsc = searchParams.get("order") === "asc";
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10) || 200, 500);

  const sb = createAdminClient();
  const listOrder = attention || orderAsc;
  let q = sb
    .from("leads")
    .select("*")
    .order("created_at", { ascending: listOrder })
    .limit(limit);

  if (mine && user) {
    q = q.eq("assigned_to", user.id);
  }

  if (attention) {
    q = sb
      .from("leads")
      .select("*")
      .in("status", ["new", "assigned", "follow_up_sent", "awaiting_reply"])
      .is("quote_uuid", null)
      .order("created_at", { ascending: true })
      .limit(50);
  }

  const { data, error: qErr } = await q;
  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }

  return NextResponse.json({ leads: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const source = (body.source as string) || "phone_call";
  const allowed: LeadSource[] = [
    "website_form",
    "phone_call",
    "email",
    "google_ads",
    "referral",
    "partner_referral",
    "realtor",
    "walk_in",
    "social_media",
    "repeat_client",
    "other",
  ];
  if (!allowed.includes(source as LeadSource)) {
    return NextResponse.json({ error: "Invalid source" }, { status: 400 });
  }

  try {
    const sb = createAdminClient();
    const paste = String(body.raw_inquiry_text || "").trim();
    const extracted = paste ? parseRawInquiryText(paste) : null;
    const g = (k: string) => {
      const v = body[k];
      return v != null && String(v).trim() ? String(v).trim() : "";
    };
    const synthetic: Record<string, string> = {};
    const set = (key: string, val: string | null | undefined) => {
      const s = (val || "").trim();
      if (s) synthetic[key] = s;
    };
    set("first_name", g("first_name") || extracted?.first_name);
    set("last_name", g("last_name") || extracted?.last_name);
    set("email", g("email") || extracted?.email);
    set("phone", g("phone") || extracted?.phone);
    set("from_address", g("from_address") || extracted?.from_address);
    set("to_address", g("to_address") || extracted?.to_address);
    set("preferred_date", g("preferred_date") || extracted?.preferred_date);
    set("service_type", g("service_type") || extracted?.service_type);
    set("move_size", g("move_size"));
    if (paste) synthetic.message = paste;
    else set("message", g("message"));

    const parsed = parseCaptureFormPayload(synthetic);
    const lead = await createLeadFromParsedCapture(sb, parsed, {
      source: source as LeadSource,
      source_detail: (body.source_detail as string) || "Manual entry",
      send_acknowledgment: body.send_acknowledgment === true,
      skip_hubspot: body.skip_hubspot === true,
      raw_inquiry_text: paste || null,
      external_platform: g("external_platform") || null,
      external_reference: g("external_reference") || null,
    });
    return NextResponse.json({ lead });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
