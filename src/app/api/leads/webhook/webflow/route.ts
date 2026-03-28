import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runLeadCapture } from "@/lib/leads/capture-handler";
import { normalizeWebflowPayload, pickField } from "@/lib/leads/webflow-parse";

export const dynamic = "force-dynamic";

function verify(req: NextRequest): boolean {
  const secret = process.env.WEBFLOW_LEADS_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const header = req.headers.get("x-webflow-signature") ?? "";
  return bearer === secret || header === secret;
}

export async function POST(req: NextRequest) {
  if (!verify(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const flat = normalizeWebflowPayload(raw);
  const formName =
    pickField(flat, ["_form_name", "form_name", "formname"]) || "Website form";

  const email = pickField(flat, ["email", "e_mail", "email_address"]);
  const phone = pickField(flat, ["phone", "phone_number", "tel", "mobile"]);
  if (!email && !phone) {
    return NextResponse.json(
      { error: "At least one of email or phone is required" },
      { status: 400 },
    );
  }

  try {
    const sb = createAdminClient();
    const { lead_id } = await runLeadCapture(sb, raw, { source_detail: formName });
    return NextResponse.json({ success: true, lead_id });
  } catch (e) {
    console.error("[webflow leads webhook]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create lead" },
      { status: 500 },
    );
  }
}
