import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { newClaimAdminEmailHtml } from "@/lib/email/admin-templates";
import { claimCreatedByAdminEmailHtml } from "@/lib/email-templates";
import { requireRole } from "@/lib/auth/check-role";

export async function POST(req: NextRequest) {
  const { error: authErr } = await requireRole("coordinator");
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const {
      moveId,
      deliveryId,
      clientName,
      clientEmail,
      clientPhone,
      items,
      valuationTier,
      description,
    } = body;

    if (!clientName || !clientEmail) {
      return NextResponse.json({ error: "Client name and email are required" }, { status: 400 });
    }
    if (!items || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    let crewTeam: string | null = null;
    let crewMembers: string[] = [];

    const jobTable = moveId ? "moves" : deliveryId ? "deliveries" : null;
    const jobId = moveId || deliveryId;

    if (jobTable && jobId) {
      const { data: job } = await supabase
        .from(jobTable)
        .select("crew_id")
        .eq("id", jobId)
        .maybeSingle();

      if (job?.crew_id) {
        const { data: crew } = await supabase
          .from("crews")
          .select("name, members")
          .eq("id", job.crew_id)
          .maybeSingle();
        if (crew) {
          crewTeam = crew.name || null;
          crewMembers = crew.members || [];
        }
      }
    }

    const totalClaimedValue = items.reduce(
      (sum: number, item: { declared_value?: number }) => sum + (item.declared_value || 0),
      0,
    );

    const { data: claim, error } = await supabase
      .from("claims")
      .insert({
        claim_number: "",
        move_id: moveId || null,
        delivery_id: deliveryId || null,
        client_name: clientName,
        client_email: clientEmail.toLowerCase(),
        client_phone: clientPhone || null,
        valuation_tier: valuationTier || "released",
        was_upgraded: false,
        items,
        total_claimed_value: totalClaimedValue,
        crew_team: crewTeam,
        crew_members: crewMembers,
        status: "under_review",
      })
      .select("id, claim_number")
      .single();

    if (error) {
      console.error("Failed to create claim:", error);
      return NextResponse.json({ error: "Failed to create claim" }, { status: 500 });
    }

    await supabase.from("claim_timeline").insert({
      claim_id: claim.id,
      event_type: "submitted",
      event_description: `Claim created by admin.${description ? ` Notes: ${description}` : ""} ${items.length} item(s), $${totalClaimedValue.toLocaleString()} total declared value.`,
    });

    sendEmail({
      to: clientEmail.toLowerCase(),
      subject: `Claim ${claim.claim_number} Filed Yugo`,
      html: claimCreatedByAdminEmailHtml(claim.claim_number, clientName, items.length, totalClaimedValue),
    }).catch(() => {});

    notifyAdmins("quote_requested", {
      subject: `New Claim: ${claim.claim_number}`,
      body: `Admin-created claim for ${clientName}. ${items.length} item(s), $${totalClaimedValue.toLocaleString()} total. ${valuationTier || "released"} valuation.`,
      html: newClaimAdminEmailHtml({
        claimNumber: claim.claim_number,
        clientName,
        itemCount: items.length,
        totalClaimed: totalClaimedValue,
        valuationTier: valuationTier || "released",
        claimId: claim.id,
        adminCreated: true,
      }),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      claimId: claim.id,
      claimNumber: claim.claim_number,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
