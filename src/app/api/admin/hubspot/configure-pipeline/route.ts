import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/**
 * POST /api/admin/hubspot/configure-pipeline
 *
 * Fetches the OPS+ HubSpot pipeline stages and writes their internal IDs
 * into platform_config so that deal creation and stage sync work automatically.
 *
 * Requires HUBSPOT_ACCESS_TOKEN and hubspot_pipeline_id to be set.
 */
export async function POST() {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "HUBSPOT_ACCESS_TOKEN environment variable is not set" },
      { status: 503 },
    );
  }

  const db = createAdminClient();

  const { data: pipelineRow } = await db
    .from("platform_config")
    .select("value")
    .eq("key", "hubspot_pipeline_id")
    .maybeSingle();

  const pipelineId = pipelineRow?.value?.trim() || process.env.HUBSPOT_PIPELINE_ID?.trim();
  if (!pipelineId) {
    return NextResponse.json(
      { error: "hubspot_pipeline_id is not set in platform_config" },
      { status: 400 },
    );
  }

  const stagesRes = await fetch(
    `https://api.hubapi.com/crm/v3/pipelines/deals/${pipelineId}/stages`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!stagesRes.ok) {
    const t = await stagesRes.text();
    return NextResponse.json(
      { error: `HubSpot returned ${stagesRes.status}`, detail: t.slice(0, 500) },
      { status: 502 },
    );
  }

  const { results } = (await stagesRes.json()) as {
    results: { id: string; label: string }[];
  };

  // Map HubSpot stage labels (case-insensitive, partial match) to platform_config keys.
  const LABEL_TO_CONFIG_KEY: { pattern: RegExp; key: string }[] = [
    { pattern: /new\s*lead/i,              key: "hubspot_stage_new_lead" },
    { pattern: /contacted/i,              key: "hubspot_stage_contacted" },
    { pattern: /ready.*(quote|estimate)/i, key: "hubspot_stage_quote_draft" },
    { pattern: /quote\s*sent/i,           key: "hubspot_stage_quote_sent" },
    { pattern: /quote\s*view/i,           key: "hubspot_stage_quote_viewed" },
    { pattern: /deposit\s*receiv/i,       key: "hubspot_stage_deposit_received" },
    { pattern: /booked|scheduled/i,       key: "hubspot_stage_booked" },
    { pattern: /in.progress|in_progress/i,key: "hubspot_stage_in_progress" },
    { pattern: /closed\s*won|won/i,       key: "hubspot_stage_closed_won" },
    { pattern: /closed\s*lost|lost/i,     key: "hubspot_stage_closed_lost" },
  ];

  const upserted: { configKey: string; stageLabel: string; stageId: string }[] = [];
  const unmatched: { id: string; label: string }[] = [];

  for (const stage of results) {
    const match = LABEL_TO_CONFIG_KEY.find((m) => m.pattern.test(stage.label));
    if (match) {
      upserted.push({ configKey: match.key, stageLabel: stage.label, stageId: stage.id });
    } else {
      unmatched.push(stage);
    }
  }

  if (upserted.length > 0) {
    const rows = upserted.map(({ configKey, stageId }) => ({
      key: configKey,
      value: stageId,
      description: `HubSpot stage ID (auto-configured from pipeline ${pipelineId})`,
    }));
    const { error: upsertErr } = await db
      .from("platform_config")
      .upsert(rows, { onConflict: "key" });

    if (upsertErr) {
      return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    pipelineId,
    configured: upserted,
    unmatched,
  });
}
