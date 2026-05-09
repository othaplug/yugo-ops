import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { generateNextQuoteId } from "@/lib/quotes/quote-id";
import { logActivity } from "@/lib/activity";

/**
 * POST /api/admin/quotes/[quoteId]/duplicate
 *
 * Creates a new draft quote copied from an existing one.
 * The new quote gets a fresh YG- ID, status = "draft", version = 1.
 * The source quote's ID is stored in duplicated_from.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  try {
    const { error: authError } = await requireStaff();
    if (authError) return authError;

    const { quoteId } = await params;
    const supabase = createAdminClient();

    /* ── Fetch source quote ── */
    const { data: source, error: srcErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("quote_id", quoteId)
      .single();

    if (srcErr || !source) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    /* ── Generate new ID ── */
    const newQuoteId = await generateNextQuoteId(supabase);

    /* ── Strip identity & versioning columns, reset to draft ── */
    const {
      id: _id,
      quote_id: _qid,
      created_at: _createdAt,
      updated_at: _updatedAt,
      sent_at: _sentAt,
      viewed_at: _viewedAt,
      accepted_at: _acceptedAt,
      expires_at: _expiresAt,
      status: _status,
      version: _version,
      last_regenerated_at: _lrAt,
      last_regenerated_by: _lrBy,
      is_revised: _isRevised,
      parent_quote_id: _parentId,
      superseded_by: _supBy,
      superseded_at: _supAt,
      duplicated_from: _dupFrom,
      hubspot_deal_id: _hsId,
      quote_url: _quoteUrl,
      public_action_token: _token,
      photo_survey_sent_at: _photoAt,
      ...copyFields
    } = source as Record<string, unknown>;

    const newQuotePayload = {
      ...copyFields,
      quote_id: newQuoteId,
      status: "draft",
      version: 1,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      duplicated_from: (source as any).id ?? null,
      created_at: new Date().toISOString(),
    };

    const MAX_ATTEMPTS = 4;
    let finalQuoteId = newQuoteId;
    let inserted = false;
    let currentId = newQuoteId;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { error: insertErr } = await supabase
        .from("quotes")
        .insert({ ...newQuotePayload, quote_id: currentId });

      if (!insertErr) {
        finalQuoteId = currentId;
        inserted = true;
        break;
      }

      const isDup =
        insertErr.code === "23505" ||
        (insertErr.message || "").toLowerCase().includes("duplicate");

      if (isDup && attempt < MAX_ATTEMPTS - 1) {
        currentId = await generateNextQuoteId(supabase);
        continue;
      }

      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    if (!inserted) {
      return NextResponse.json({ error: "Failed to insert duplicate quote" }, { status: 500 });
    }

    await logActivity({
      entity_type: "quote",
      entity_id: finalQuoteId,
      event_type: "created",
      description: `Quote duplicated from ${quoteId} → ${finalQuoteId}`,
      icon: "quote",
    });

    return NextResponse.json({ success: true, newQuoteId: finalQuoteId });
  } catch (e) {
    console.error("[quotes/duplicate]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unexpected error" },
      { status: 500 },
    );
  }
}
