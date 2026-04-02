import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { runLeadCapture } from "@/lib/leads/capture-handler";
import { pickField, normalizeWebflowPayload } from "@/lib/leads/webflow-parse";

export const dynamic = "force-dynamic";

function verify(req: NextRequest): boolean {
  const secret =
    process.env.LEADS_CAPTURE_WEBHOOK_SECRET?.trim() ||
    process.env.WEBFLOW_LEADS_WEBHOOK_SECRET?.trim();
  if (!secret) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const header = req.headers.get("x-webflow-signature") ?? "";
  const h = (s: string) => createHash("sha256").update(s).digest();
  return h(bearer).equals(h(secret)) || h(header).equals(h(secret));
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
    pickField(flat, ["_form_name", "form_name", "formname"]) || "Webflow quote form";

  try {
    const sb = createAdminClient();
    const { lead_id } = await runLeadCapture(sb, raw, {
      source_detail: formName,
    });
    return NextResponse.json({ success: true, lead_id });
  } catch (e) {
    console.error("[leads/capture]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create lead" },
      { status: 500 },
    );
  }
}
