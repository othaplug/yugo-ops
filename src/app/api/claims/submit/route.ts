import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { newClaimAdminEmailHtml } from "@/lib/email/admin-templates";
import { claimConfirmationEmailHtml } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { moveId, deliveryId, clientName, clientEmail, clientPhone, items, valuationTier, wasUpgraded } = body;

    if (!clientName || !clientEmail || !items || items.length === 0) {
      return NextResponse.json({ error: "clientName, clientEmail, and at least one item are required" }, { status: 400 });
    }

    if (!moveId && !deliveryId) {
      return NextResponse.json({ error: "Either moveId or deliveryId is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    if (moveId) {
      const { data: move } = await supabase.from("moves").select("id").eq("id", moveId).maybeSingle();
      if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });
    }
    if (deliveryId) {
      const { data: delivery } = await supabase.from("deliveries").select("id").eq("id", deliveryId).maybeSingle();
      if (!delivery) return NextResponse.json({ error: "Delivery not found" }, { status: 404 });
    }

    const totalClaimedValue = items.reduce((sum: number, item: { declared_value?: number }) => sum + (item.declared_value || 0), 0);

    let crewTeam: string | null = null;
    let crewMembers: string[] = [];

    const jobTable = moveId ? "moves" : "deliveries";
    const jobId = moveId || deliveryId;
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
        was_upgraded: wasUpgraded || false,
        items,
        total_claimed_value: totalClaimedValue,
        crew_team: crewTeam,
        crew_members: crewMembers,
      })
      .select("id, claim_number")
      .single();

    if (error) {
      console.error("Failed to create claim:", error);
      return NextResponse.json({ error: "Failed to submit claim" }, { status: 500 });
    }

    await supabase.from("claim_timeline").insert({
      claim_id: claim.id,
      event_type: "submitted",
      event_description: `Claim submitted by client. ${items.length} item(s), $${totalClaimedValue.toLocaleString()} total declared value.`,
    });

    sendEmail({
      to: clientEmail.toLowerCase(),
      subject: `Claim ${claim.claim_number} Submitted — Yugo`,
      html: claimConfirmationEmailHtml(claim.claim_number, clientName, items.length, totalClaimedValue),
    }).catch(() => {});

    notifyAdmins("quote_requested", {
      subject: `New Claim: ${claim.claim_number}`,
      body: `New damage claim from ${clientName}. ${items.length} item(s), $${totalClaimedValue.toLocaleString()} total. ${valuationTier || "released"} valuation.`,
      html: newClaimAdminEmailHtml({
        claimNumber: claim.claim_number,
        clientName,
        itemCount: items.length,
        totalClaimed: totalClaimedValue,
        valuationTier: valuationTier || "released",
        claimId: claim.id,
        adminCreated: false,
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
