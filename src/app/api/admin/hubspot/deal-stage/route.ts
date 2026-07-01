import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";

/** GET /api/admin/hubspot/deal-stage?dealId=12345
 *
 *  Fetch a HubSpot deal's dealstage + pipeline so the quote detail
 *  page can surface "Stage: Proposal Sent" next to the linked deal
 *  pill. Previously the page rendered only the bare deal id, leaving
 *  the coordinator to pivot to HubSpot before every call. Returns:
 *    { stageId, stageLabel, pipelineId }
 *  Stage label resolution is best-effort: we try the pipeline's
 *  stages endpoint, fall back to a humanized stage id.
 */
export async function GET(req: NextRequest) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const dealId = req.nextUrl.searchParams.get("dealId")?.trim();
  if (!dealId) {
    return NextResponse.json({ error: "dealId required" }, { status: 400 });
  }

  const token = process.env.HUBSPOT_TOKEN?.trim();
  if (!token) {
    return NextResponse.json({ error: "hubspot_unavailable" }, { status: 503 });
  }

  try {
    const dealRes = await fetch(
      `https://api.hubapi.com/crm/v3/objects/deals/${encodeURIComponent(dealId)}?properties=dealstage,pipeline`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!dealRes.ok) {
      return NextResponse.json(
        { error: `hubspot_${dealRes.status}` },
        { status: 502 },
      );
    }
    const deal = (await dealRes.json()) as {
      properties?: { dealstage?: string; pipeline?: string };
    };
    const stageId = String(deal.properties?.dealstage ?? "").trim();
    const pipelineId = String(deal.properties?.pipeline ?? "").trim();
    if (!stageId) {
      return NextResponse.json({ stageId: null, stageLabel: null, pipelineId });
    }

    // Try to resolve the human label via the pipeline endpoint.
    let stageLabel: string | null = null;
    if (pipelineId) {
      const pipeRes = await fetch(
        `https://api.hubapi.com/crm/v3/pipelines/deals/${encodeURIComponent(pipelineId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (pipeRes.ok) {
        const pipe = (await pipeRes.json()) as {
          stages?: { id: string; label: string }[];
        };
        const match = pipe.stages?.find((s) => s.id === stageId);
        if (match?.label) stageLabel = match.label;
      }
    }
    if (!stageLabel) {
      stageLabel = stageId
        .replace(/[_-]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return NextResponse.json({ stageId, stageLabel, pipelineId });
  } catch {
    return NextResponse.json({ error: "hubspot_fetch_failed" }, { status: 502 });
  }
}
