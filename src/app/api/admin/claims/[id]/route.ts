import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import {
  claimApprovalEmailHtml,
  claimDenialEmailHtml,
  claimStatusUpdateEmailHtml,
} from "@/lib/email-templates";
import { requireRole } from "@/lib/auth/check-role";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const supabase = createAdminClient();

    const [{ data: claim }, { data: photos }, { data: timeline }] = await Promise.all([
      supabase.from("claims").select("*").eq("id", id).single(),
      supabase.from("claim_photos").select("*").eq("claim_id", id).order("created_at", { ascending: true }),
      supabase.from("claim_timeline").select("*").eq("claim_id", id).order("created_at", { ascending: true }),
    ]);

    if (!claim) {
      return NextResponse.json({ error: "Claim not found" }, { status: 404 });
    }

    return NextResponse.json({ claim, photos: photos || [], timeline: timeline || [] });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  try {
    const { id } = await params;
    const body = await req.json();
    const { action, ...updates } = body;
    const supabase = createAdminClient();

    const { data: claim } = await supabase.from("claims").select("*").eq("id", id).single();
    if (!claim) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

    if (action === "approve") {
      const approvedAmount = updates.approved_amount || 0;
      const { error } = await supabase
        .from("claims")
        .update({
          status: approvedAmount < claim.total_claimed_value ? "partially_approved" : "approved",
          approved_amount: approvedAmount,
          resolution_type: updates.resolution_type || "cash_settlement",
          resolution_notes: updates.resolution_notes || null,
          payout_method: updates.payout_method || "e_transfer",
          assessment_notes: updates.assessment_notes || null,
          assessed_at: new Date().toISOString(),
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await supabase.from("claim_timeline").insert({
        claim_id: id,
        event_type: "status_changed",
        event_description: `Claim approved. Amount: $${approvedAmount.toLocaleString()}. Resolution: ${updates.resolution_type || "cash_settlement"}.`,
        user_id: updates.assessed_by || null,
      });

      sendEmail({
        to: claim.client_email,
        subject: `Claim ${claim.claim_number} — Approved`,
        html: claimApprovalEmailHtml(claim.claim_number, claim.client_name, approvedAmount, updates.resolution_notes || ""),
      }).catch(() => {});
    } else if (action === "deny") {
      if (!updates.resolution_notes) {
        return NextResponse.json({ error: "Denial reason is required" }, { status: 400 });
      }
      const { error } = await supabase
        .from("claims")
        .update({
          status: "denied",
          resolution_type: "denied",
          resolution_notes: updates.resolution_notes,
          assessment_notes: updates.assessment_notes || null,
          assessed_at: new Date().toISOString(),
          resolved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await supabase.from("claim_timeline").insert({
        claim_id: id,
        event_type: "status_changed",
        event_description: `Claim denied. Reason: ${updates.resolution_notes}`,
        user_id: updates.assessed_by || null,
      });

      sendEmail({
        to: claim.client_email,
        subject: `Claim ${claim.claim_number} — Review Complete`,
        html: claimDenialEmailHtml(claim.claim_number, claim.client_name, updates.resolution_notes),
      }).catch(() => {});
    } else {
      const { error } = await supabase.from("claims").update(updates).eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (updates.status && updates.status !== claim.status) {
        const fromLabel = claim.status.replace(/_/g, " ");
        const toLabel = updates.status.replace(/_/g, " ");

        await supabase.from("claim_timeline").insert({
          claim_id: id,
          event_type: "status_changed",
          event_description: `Status changed from ${fromLabel} to ${toLabel}.`,
          user_id: updates.assessed_by || null,
        });

        sendEmail({
          to: claim.client_email,
          subject: `Claim ${claim.claim_number} — Status Update`,
          html: claimStatusUpdateEmailHtml(claim.claim_number, claim.client_name, fromLabel, toLabel, updates.resolution_notes || null),
        }).catch(() => {});
      }
    }

    const { data: updated } = await supabase.from("claims").select("*").eq("id", id).single();
    return NextResponse.json({ claim: updated });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
