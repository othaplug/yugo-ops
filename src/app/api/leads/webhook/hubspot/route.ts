import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hubSpotSignedUris, verifyHubSpotSignature } from "@/lib/hubspot/verify-webhook-signature";
import { createLeadPipeline } from "@/lib/leads/inbound";
import { mapInboundServiceType } from "@/lib/leads/webflow-parse";

export const dynamic = "force-dynamic";

/**
 * HubSpot workflow / custom code can POST new contact payloads here to mirror into Yugo.
 *
 * Accepted when either check passes (both fail closed when their secret is unset):
 *   1. A valid HubSpot request signature (v1, v2 or v3) made with HUBSPOT_CLIENT_SECRET.
 *   2. Authorization: Bearer <HUBSPOT_INBOUND_LEADS_SECRET>, the existing workflow setup,
 *      now compared in constant time.
 */
function bearerMatches(req: NextRequest): boolean {
  const secret = process.env.HUBSPOT_INBOUND_LEADS_SECRET?.trim();
  if (!secret) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(bearer, "utf8");
  const b = Buffer.from(secret, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

function verify(req: NextRequest, rawBody: string): boolean {
  const clientSecret = process.env.HUBSPOT_CLIENT_SECRET?.trim() ?? "";
  if (clientSecret) {
    const check = verifyHubSpotSignature({
      secret: clientSecret,
      method: req.method,
      uris: hubSpotSignedUris(req),
      rawBody,
      headers: req.headers,
    });
    if (check.valid) return true;
  }
  return bearerMatches(req);
}

export async function POST(req: NextRequest) {
  // Read the raw body once: the signature covers the exact bytes HubSpot sent.
  const rawBody = await req.text();
  if (!verify(req, rawBody)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody || "{}") as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const props = (body.properties as Record<string, unknown>) || body;
  const g = (k: string) => {
    const v = props[k];
    if (v && typeof v === "object" && "value" in (v as object)) {
      return String((v as { value: unknown }).value ?? "").trim();
    }
    return v != null ? String(v).trim() : "";
  };

  const email = g("email") || g("Email");
  const phone = g("phone") || g("Phone") || g("mobilephone") || g("Mobile");
  const first = g("firstname") || g("First Name");
  const last = g("lastname") || g("Last Name");
  const hsContactId = g("hs_object_id") || g("contact_id") || "";

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
      source: "other",
      source_detail: "HubSpot",
      service_type: mapInboundServiceType(g("service_type")) ?? undefined,
      message: g("message") || g("notes") || null,
      skip_hubspot: true,
    });

    if (hsContactId) {
      await sb.from("leads").update({ hubspot_contact_id: hsContactId }).eq("id", lead.id as string);
    }

    return NextResponse.json({ success: true, lead_id: lead.id });
  } catch (e) {
    console.error("[hubspot inbound leads]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}
