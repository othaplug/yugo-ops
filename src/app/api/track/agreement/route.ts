import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import {
  TRACKING_TERMS_VERSION,
  type AgreementEntityType,
} from "@/lib/tracking-agreement";

const ENTITY_TYPES: AgreementEntityType[] = ["move", "delivery", "inbound_shipment"];

function isEntityType(v: string): v is AgreementEntityType {
  return (ENTITY_TYPES as string[]).includes(v);
}

/** Snapshot the client's name/email for the given entity (best-effort). */
async function identityFor(
  db: ReturnType<typeof createAdminClient>,
  entityType: AgreementEntityType,
  entityId: string,
): Promise<{ name: string | null; email: string | null }> {
  try {
    if (entityType === "move") {
      const { data } = await db.from("moves").select("client_name, client_email").eq("id", entityId).single();
      return { name: data?.client_name ?? null, email: data?.client_email ?? null };
    }
    if (entityType === "delivery") {
      const { data } = await db.from("deliveries").select("client_name, client_email").eq("id", entityId).single();
      return { name: data?.client_name ?? null, email: data?.client_email ?? null };
    }
    // inbound_shipment: prefer the end customer, fall back to the business
    const { data } = await db
      .from("inbound_shipments")
      .select("customer_name, customer_email, business_name, business_email")
      .eq("id", entityId)
      .single();
    return {
      name: data?.customer_name ?? data?.business_name ?? null,
      email: data?.customer_email ?? data?.business_email ?? null,
    };
  } catch {
    return { name: null, email: null };
  }
}

/** GET ?entityType=&entityId=&token= → { accepted } for the current terms version. */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const entityType = String(sp.get("entityType") || "");
  const entityId = String(sp.get("entityId") || "");
  const token = String(sp.get("token") || "");

  if (!isEntityType(entityType) || !entityId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!verifyTrackToken(entityType, entityId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();
  const { count } = await db
    .from("tracking_agreement_acceptances")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("terms_version", TRACKING_TERMS_VERSION);

  return NextResponse.json({ accepted: (count ?? 0) > 0, version: TRACKING_TERMS_VERSION });
}

/** POST { entityType, entityId } with Bearer token → record acceptance. */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "").trim();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const entityType = String(body.entityType || "");
  const entityId = String(body.entityId || "");
  const token = bearer || String(body.token || "");

  if (!isEntityType(entityType) || !entityId) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!verifyTrackToken(entityType, entityId, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createAdminClient();

  // Skip a duplicate row if this entity already accepted the current version
  // (e.g. a double-click, or cookie cleared on a device that already recorded).
  const { count } = await db
    .from("tracking_agreement_acceptances")
    .select("id", { count: "exact", head: true })
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("terms_version", TRACKING_TERMS_VERSION);
  if ((count ?? 0) > 0) {
    return NextResponse.json({ ok: true, alreadyRecorded: true });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    null;
  const userAgent = req.headers.get("user-agent")?.slice(0, 500) || null;
  const { name, email } = await identityFor(db, entityType, entityId);

  const { error } = await db.from("tracking_agreement_acceptances").insert({
    entity_type: entityType,
    entity_id: entityId,
    terms_version: TRACKING_TERMS_VERSION,
    ip,
    user_agent: userAgent,
    client_name: name,
    client_email: email,
  });
  if (error) {
    console.error("[track agreement] insert failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
