import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const HS_BASE = "https://api.hubapi.com/crm/v3";

function hsHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
    "Content-Type": "application/json",
  };
}

/**
 * POST /api/hubspot/search
 *
 * Body: { email: string, phone?: string }
 *
 * Returns the first HubSpot contact matching the given email, including
 * associated deal IDs.  Returns { contact: null } when no match or if
 * HubSpot is unreachable.
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const { email, phone: _phone } = await req.json().catch(() => ({}));

  if (!email || typeof email !== "string") {
    return NextResponse.json({ contact: null });
  }

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return NextResponse.json({ contact: null });

  try {
    const searchBody = {
      filterGroups: [
        {
          filters: [
            { propertyName: "email", operator: "EQ", value: email.trim().toLowerCase() },
          ],
        },
      ],
      properties: [
        "firstname",
        "lastname",
        "email",
        "phone",
        "company",
        "jobtitle",
        "hs_lead_status",
      ],
      limit: 1,
    };

    const searchRes = await fetch(`${HS_BASE}/objects/contacts/search`, {
      method: "POST",
      headers: hsHeaders(),
      body: JSON.stringify(searchBody),
    });

    if (!searchRes.ok) return NextResponse.json({ contact: null });

    const searchData = await searchRes.json();
    if (!searchData.results?.length) return NextResponse.json({ contact: null });

    const contact = searchData.results[0];
    const p = contact.properties ?? {};

    // Fetch associated deals (non-critical)
    let dealIds: string[] = [];
    try {
      const dealsRes = await fetch(
        `${HS_BASE}/objects/contacts/${contact.id}/associations/deals`,
        { headers: hsHeaders() },
      );
      if (dealsRes.ok) {
        const dealsData = await dealsRes.json();
        dealIds = (dealsData.results ?? []).map((d: { id: string }) => d.id);
      }
    } catch {
      // non-critical
    }

    return NextResponse.json({
      contact: {
        hubspot_id: contact.id as string,
        first_name: (p.firstname as string) || "",
        last_name: (p.lastname as string) || "",
        email: (p.email as string) || "",
        phone: (p.phone as string) || "",
        company: (p.company as string) || "",
        title: (p.jobtitle as string) || "",
        lead_status: (p.hs_lead_status as string) || "",
        deal_ids: dealIds,
      },
    });
  } catch {
    return NextResponse.json({ contact: null });
  }
}
