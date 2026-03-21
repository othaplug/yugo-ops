import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/check-role";

/**
 * POST { key: "square" | "resend" | ... } — runs a real connectivity check for configured integrations.
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireRole("manager");
  if (authErr) return authErr;

  let body: { key?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const key = body.key;
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "key required" }, { status: 400 });
  }

  const started = Date.now();

  try {
    const result = await runIntegrationCheck(key);
    const ms = Date.now() - started;
    return NextResponse.json({ ok: result.ok, message: result.message, ms });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Check failed";
    return NextResponse.json({ ok: false, message: msg, ms: Date.now() - started }, { status: 200 });
  }
}

async function runIntegrationCheck(key: string): Promise<{ ok: boolean; message: string }> {
  switch (key) {
    case "square": {
      const token = process.env.SQUARE_ACCESS_TOKEN;
      if (!token) return { ok: false, message: "SQUARE_ACCESS_TOKEN not set" };
      const base =
        process.env.SQUARE_ENVIRONMENT === "production"
          ? "https://connect.squareup.com"
          : "https://connect.squareupsandbox.com";
      const res = await fetch(`${base}/v2/locations`, {
        headers: { Authorization: `Bearer ${token}`, "Square-Version": "2024-01-18" },
      });
      if (!res.ok) return { ok: false, message: `Square API ${res.status}` };
      return { ok: true, message: "Square API reachable" };
    }
    case "resend": {
      const keyR = process.env.RESEND_API_KEY;
      if (!keyR) return { ok: false, message: "RESEND_API_KEY not set" };
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${keyR}` },
      });
      if (!res.ok) return { ok: false, message: `Resend API ${res.status}` };
      return { ok: true, message: "Resend API reachable" };
    }
    case "mapbox": {
      const t = process.env.MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (!t) return { ok: false, message: "MAPBOX_TOKEN not set" };
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/toronto.json?access_token=${encodeURIComponent(t)}&limit=1`
      );
      if (!res.ok) return { ok: false, message: `Mapbox API ${res.status}` };
      return { ok: true, message: "Mapbox Geocoding reachable" };
    }
    case "openphone": {
      const k = process.env.OPENPHONE_API_KEY;
      if (!k) return { ok: false, message: "OPENPHONE_API_KEY not set" };
      const res = await fetch("https://api.openphone.com/v1/phone-numbers", {
        headers: { Authorization: k },
      });
      if (!res.ok) return { ok: false, message: `OpenPhone API ${res.status}` };
      return { ok: true, message: "OpenPhone API reachable" };
    }
    case "hubspot": {
      const k = process.env.HUBSPOT_ACCESS_TOKEN;
      if (!k) return { ok: false, message: "HUBSPOT_ACCESS_TOKEN not set" };
      const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts?limit=1", {
        headers: { Authorization: `Bearer ${k}` },
      });
      if (!res.ok) return { ok: false, message: `HubSpot API ${res.status}` };
      return { ok: true, message: "HubSpot CRM reachable" };
    }
    case "quickbooks": {
      const id = process.env.QUICKBOOKS_CLIENT_ID;
      const secret = process.env.QUICKBOOKS_CLIENT_SECRET;
      if (!id || !secret) {
        return { ok: false, message: "Set QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET in environment" };
      }
      return { ok: true, message: "QuickBooks OAuth credentials present (complete OAuth in your deployment)" };
    }
    case "zapier": {
      const s = process.env.ZAPIER_WEBHOOK_SECRET;
      if (!s) return { ok: false, message: "ZAPIER_WEBHOOK_SECRET not set" };
      return { ok: true, message: "Zapier webhook secret configured" };
    }
    case "slack": {
      const url = process.env.SLACK_WEBHOOK_URL;
      if (!url) return { ok: false, message: "SLACK_WEBHOOK_URL not set" };
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Yugo+ integration test — you can delete this message." }),
      });
      if (!res.ok) return { ok: false, message: `Slack webhook ${res.status}` };
      return { ok: true, message: "Test message sent to Slack" };
    }
    default:
      return { ok: false, message: "Unknown integration" };
  }
}
