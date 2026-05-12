import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";

const HS_BASE = "https://api.hubapi.com/crm/v3/objects";
const CACHE_SECONDS = 300; // 5 minutes

const DEAL_PROPERTIES = [
  "dealname",
  "dealstage",
  "amount",
  "service_type",
  "move_date",
  "move_size",
  "pick_up_address",
  "drop_off_address",
  // portal calls these "Access from" → access, and "Access to" → access_to.
  // The old `access_from` GET request was 404-ing on every read because the
  // property doesn't exist; pulling `access` makes the admin pre-fill match
  // the actual deal data the owner sees in HubSpot.
  "access",
  "access_to",
  "firstname",
  "lastname",
  "client_name",
  "last_name",
  "package_type",
  "job_no",
  "sub_total",
  "taxes",
  "total_price",
  "additional_info",
  "lost_reason",
  "dealtype",
  "agent",
  "square_footage",
  "workstation_count",
].join(",");

const CONTACT_PROPERTIES = "firstname,lastname,email,phone,address,city,zip";

function hsHeaders(): HeadersInit {
  return { Authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}` };
}

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAuth();
  if (authErr) return authErr;

  const dealId = req.nextUrl.searchParams.get("dealId");
  if (!dealId) {
    return NextResponse.json({ error: "dealId query param is required" }, { status: 400 });
  }

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "HUBSPOT_ACCESS_TOKEN not configured" }, { status: 500 });
  }

  try {
    // ── Fetch deal ────────────────────────────
    const dealRes = await fetch(
      `${HS_BASE}/deals/${dealId}?properties=${DEAL_PROPERTIES}`,
      { headers: hsHeaders(), next: { revalidate: CACHE_SECONDS } },
    );

    if (dealRes.status === 404) {
      return NextResponse.json({ error: `Deal ${dealId} not found` }, { status: 404 });
    }
    if (dealRes.status === 429) {
      const retryAfter = dealRes.headers.get("Retry-After") || "10";
      return NextResponse.json(
        { error: "HubSpot rate limit exceeded" },
        { status: 429, headers: { "Retry-After": retryAfter } },
      );
    }
    if (!dealRes.ok) {
      const text = await dealRes.text();
      return NextResponse.json({ error: `HubSpot ${dealRes.status}: ${text}` }, { status: 502 });
    }

    const deal = await dealRes.json();
    const p = deal.properties ?? {};

    // ── Fetch associated contact ──────────────
    let contactEmail = "";
    let contactPhone = "";
    let contactFirstName = "";
    let contactLastName = "";

    try {
      const assocRes = await fetch(
        `${HS_BASE}/deals/${dealId}/associations/contacts`,
        { headers: hsHeaders(), next: { revalidate: CACHE_SECONDS } },
      );

      if (assocRes.ok) {
        const assocData = await assocRes.json();
        const contactId = assocData.results?.[0]?.id;

        if (contactId) {
          const cRes = await fetch(
            `${HS_BASE}/contacts/${contactId}?properties=${CONTACT_PROPERTIES}`,
            { headers: hsHeaders(), next: { revalidate: CACHE_SECONDS } },
          );
          if (cRes.ok) {
            const cp = (await cRes.json()).properties ?? {};
            contactFirstName = cp.firstname ?? "";
            contactLastName = cp.lastname ?? "";
            contactEmail = cp.email ?? "";
            contactPhone = cp.phone ?? "";
          }
        }
      }
    } catch {
      // Non-critical — proceed without contact data
    }

    const firstName = (p.firstname || contactFirstName || "").trim();
    const lastName = (p.lastname || contactLastName || "").trim();

    const response = NextResponse.json({
      dealId,
      jobNo: p.job_no || dealId,
      dealName: p.dealname ?? "",
      dealStage: p.dealstage ?? "",
      serviceType: p.service_type ?? "",
      moveSize: (p.move_size ?? "").toLowerCase(),
      fromAddress: p.pick_up_address ?? "",
      toAddress: p.drop_off_address ?? "",
      fromAccess: (p.access_from ?? "").toLowerCase().replace(/\s+/g, "_"),
      toAccess: (p.access_to ?? "").toLowerCase().replace(/\s+/g, "_"),
      moveDate: p.move_date ?? "",
      firstName,
      lastName,
      email: contactEmail,
      phone: contactPhone,
      amount: p.amount ? Number(p.amount) : null,
      packageType: p.package_type ?? null,
      additionalInfo: p.additional_info ?? "",
      agent: p.agent ?? "",
      squareFootage: p.square_footage ?? "",
      workstationCount: p.workstation_count ?? "",
    });

    response.headers.set("Cache-Control", `s-maxage=${CACHE_SECONDS}, stale-while-revalidate=60`);
    return response;
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch deal" },
      { status: 500 },
    );
  }
}
