import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createLeadPipeline } from "@/lib/leads/inbound";
import { mapInboundServiceType } from "@/lib/leads/webflow-parse";

export const dynamic = "force-dynamic";

function verify(req: NextRequest): boolean {
  const secret = process.env.GOOGLE_ADS_LEADS_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  return bearer === secret;
}

export async function POST(req: NextRequest) {
  if (!verify(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const g = (k: string) => {
    const v = body[k] ?? body[k.toLowerCase()];
    return v != null ? String(v).trim() : "";
  };

  const email = g("email") || g("user_column_data_email") || "";
  const phone = g("phone") || g("phone_number") || g("user_column_data_phone") || "";
  const fullName = g("full_name") || g("name") || "";
  const [first, ...rest] = fullName.split(/\s+/).filter(Boolean);
  const last = rest.join(" ");

  if (!email && !phone) {
    return NextResponse.json({ error: "email or phone required" }, { status: 400 });
  }

  try {
    const sb = createAdminClient();
    const lead = await createLeadPipeline(sb, {
      first_name: first || null,
      last_name: last || null,
      email: email || null,
      phone: phone || null,
      source: "google_ads",
      source_detail: g("campaign_name") || g("ad_group_name") || "Google Ads lead form",
      service_type: mapInboundServiceType(g("service_type") || g("service")) ?? undefined,
      move_size: g("move_size") || null,
      from_address: g("from_address") || null,
      to_address: g("to_address") || null,
      preferred_date: g("move_date") || g("preferred_date") || null,
      message: g("message") || null,
      priority: "high",
    });

    return NextResponse.json({ success: true, lead_id: lead.id });
  } catch (e) {
    console.error("[google ads leads webhook]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
