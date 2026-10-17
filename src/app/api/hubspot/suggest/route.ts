import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { suggestHubSpotForTypeahead } from "@/lib/hubspot/contact-search";

/**
 * POST /api/hubspot/suggest
 * Body: { query: string }
 * Returns contacts matching Company name (associated records), contact company text, name, or email.
 */
export async function POST(req: NextRequest) {
  // Staff only: this route exposes HubSpot CRM data. Partners, crew and clients get 403.
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query : "";

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ suggestions: [] });

  try {
    const rows = await suggestHubSpotForTypeahead(token, query, 12);
    return NextResponse.json({
      suggestions: rows.map((c) => ({
        hubspot_id: c.hubspot_id,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email,
        phone: c.phone,
        company: c.company,
        title: c.title,
      })),
    });
  } catch (err) {
    console.error("[api/hubspot/suggest]", err);
    return NextResponse.json({ suggestions: [] });
  }
}
