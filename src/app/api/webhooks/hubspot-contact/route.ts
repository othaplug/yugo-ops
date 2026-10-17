import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hubSpotSignedUris, verifyHubSpotSignature } from "@/lib/hubspot/verify-webhook-signature";

export async function POST(req: NextRequest) {
  const supabase = createAdminClient();
  const rawBody = await req.text();
  let payload: Record<string, unknown> = {};

  try {
    payload = JSON.parse(rawBody || "{}");
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Signature verification ──
  // Fails closed: no secret configured or a bad signature means 401/503, in
  // every environment. See src/lib/hubspot/verify-webhook-signature.ts.
  const secret = (process.env.HUBSPOT_CLIENT_SECRET || "").trim();
  if (!secret) {
    console.error("[hubspot-contact] HUBSPOT_CLIENT_SECRET not configured; rejecting webhook");
    return NextResponse.json({ error: "Webhook signing not configured" }, { status: 503 });
  }
  const check = verifyHubSpotSignature({
    secret,
    method: req.method,
    uris: hubSpotSignedUris(req),
    rawBody,
    headers: req.headers,
  });
  if (!check.valid) {
    console.warn(`[hubspot-contact] Invalid HubSpot signature (${check.reason})`);
    await logWebhook(supabase, "hubspot-contact", "signature_invalid", { reason: check.reason }, "Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // ── Extract contact properties ──
  // HubSpot workflows send either a single object or an array
  const events = Array.isArray(payload) ? payload : [payload];

  const results: { contact_id: string; email: string }[] = [];

  for (const event of events) {
    const props = (event as Record<string, unknown>).properties as Record<string, string> | undefined;
    const objectId = String(
      (event as Record<string, unknown>).objectId ||
      (event as Record<string, unknown>).vid ||
      (event as Record<string, unknown>).hs_object_id ||
      props?.hs_object_id ||
      ""
    );

    const firstname = String(props?.firstname || props?.first_name || "").trim();
    const lastname = String(props?.lastname || props?.last_name || "").trim();
    const email = String(
      props?.email ||
      (event as Record<string, unknown>).email ||
      ""
    ).trim().toLowerCase();
    const phone = String(props?.phone || props?.mobilephone || "").trim();

    const name = [firstname, lastname].filter(Boolean).join(" ") || email.split("@")[0] || "Unknown";

    // ── Validation: skip if missing email or phone ──
    if (!email) {
      await logWebhook(supabase, "hubspot-contact", "skipped_no_email", event, `No email, objectId: ${objectId}`);
      continue;
    }
    if (!phone) {
      await logWebhook(supabase, "hubspot-contact", "skipped_no_phone", event, `No phone, email: ${email}`);
      continue;
    }

    // ── Derive postal code from address properties ──
    const postalCode = String(
      props?.zip || props?.postal_code || props?.address_postal_code || ""
    ).trim() || null;

    const neighbourhood = String(
      props?.city || props?.neighbourhood || ""
    ).trim() || null;

    const leadSource = String(
      props?.hs_analytics_source || props?.lead_source || props?.lifecyclestage || "hubspot"
    ).trim();

    // ── Upsert to contacts table ──
    try {
      const { data, error } = await supabase
        .from("contacts")
        .upsert(
          {
            hubspot_contact_id: objectId || null,
            name,
            email,
            phone,
            postal_code: postalCode,
            neighbourhood,
            lead_source: leadSource,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        )
        .select("id")
        .single();

      if (error) {
        console.error("[hubspot-contact] Supabase upsert error:", error.message);
        await logWebhook(supabase, "hubspot-contact", "upsert_error", event, error.message);
        // Still return 200 — see note below
      } else if (data) {
        results.push({ contact_id: data.id, email });
        await logWebhook(supabase, "hubspot-contact", "synced", { email, contact_id: data.id, objectId }, null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[hubspot-contact] Unexpected error:", msg);
      await logWebhook(supabase, "hubspot-contact", "unexpected_error", event, msg);
    }
  }

  // Always return 200 — HubSpot retries on non-200, which would cause duplicate processing
  return NextResponse.json(
    {
      success: true,
      processed: results.length,
      contacts: results,
    },
    { status: 200 }
  );
}

async function logWebhook(
  supabase: ReturnType<typeof createAdminClient>,
  source: string,
  eventType: string,
  payload: unknown,
  error: string | null
) {
  try {
    await supabase.from("webhook_logs").insert({
      source,
      event_type: eventType,
      payload: payload as Record<string, unknown>,
      status: error ? "error" : "received",
      error,
    });
  } catch (e) {
    console.error("[webhook_logs] Failed to write log:", e);
  }
}
