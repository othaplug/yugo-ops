import { NextRequest, NextResponse } from "next/server";
import { ANTHROPIC_VISION_DEFAULT } from "@/lib/ai/anthropic-vision-model";
import { analyzePhotosWithAI } from "@/lib/ai/photo-inventory";
import { requireStaff } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { user, error } = await requireStaff();
  if (error) return error;
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { survey_id?: string; photos?: Record<string, string[]> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const surveyId = typeof body.survey_id === "string" ? body.survey_id.trim() : "";
  const photos = body.photos && typeof body.photos === "object" && !Array.isArray(body.photos)
    ? (body.photos as Record<string, string[]>)
    : null;

  if (!surveyId || !photos) {
    return NextResponse.json({ error: "survey_id and photos required" }, { status: 400 });
  }

  const sb = createAdminClient();
  const { data: survey, error: sErr } = await sb
    .from("photo_surveys")
    .select("id")
    .eq("id", surveyId)
    .maybeSingle();
  if (sErr || !survey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const { suggestions, modelUsed } = await analyzePhotosWithAI(sb, photos);
    const photoCount = Object.values(photos).reduce(
      (a, p) => a + (Array.isArray(p) ? p.length : 0),
      0,
    );

    await sb.from("ai_analysis_log").insert({
      survey_id: surveyId,
      analyzed_by: user.id,
      photo_count: photoCount,
      suggestion_count: suggestions.length,
      suggestions: suggestions as unknown as Record<string, unknown>,
    });

    await sb
      .from("photo_surveys")
      .update({ ai_analyzed: true, ai_suggestions: suggestions as unknown as Record<string, unknown> })
      .eq("id", surveyId);

    return NextResponse.json(
      { suggestions, visionModel: modelUsed },
      { headers: { "X-Yugo-Vision-Model": modelUsed } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      {
        error: "Analysis failed",
        message: msg,
        visionModel: ANTHROPIC_VISION_DEFAULT,
      },
      { status: 500 },
    );
  }
}
