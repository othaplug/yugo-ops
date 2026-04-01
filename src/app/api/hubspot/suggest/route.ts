import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { suggestHubSpotContactsByCompanyQuery } from "@/lib/hubspot/contact-search";

/**
 * POST /api/hubspot/suggest
 * Body: { query: string }
 * Returns contacts matching company (CONTAINS_TOKEN) for business-name typeahead.
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const body = await req.json().catch(() => ({}));
  const query = typeof body.query === "string" ? body.query : "";

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ suggestions: [] });

  try {
    const rows = await suggestHubSpotContactsByCompanyQuery(token, query, 12);
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
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
