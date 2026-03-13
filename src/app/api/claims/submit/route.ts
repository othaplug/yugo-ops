import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { notifyAdmins } from "@/lib/notifications/dispatch";

function claimConfirmationHtml(claimNumber: string, clientName: string, itemCount: number, totalClaimed: number): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:520px;margin:0 auto;padding:40px 24px;">
  <div style="text-align:center;margin-bottom:32px;">
    <span style="font-size:20px;font-weight:700;color:#722F37;letter-spacing:1px;">YUGO+</span>
  </div>
  <div style="background:#fff;border-radius:16px;padding:32px 28px;box-shadow:0 1px 3px rgba(0,0,0,0.06);">
    <h1 style="font-size:22px;color:#1a1a1a;margin:0 0 8px;">Claim Submitted</h1>
    <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 24px;">
      Hi ${clientName}, your claim <strong>${claimNumber}</strong> has been received.
    </p>
    <div style="background:#FAF7F2;border-radius:12px;padding:20px;margin-bottom:24px;">
      <p style="font-size:14px;color:#555;margin:0 0 4px;">${itemCount} item${itemCount !== 1 ? "s" : ""} claimed</p>
      <p style="font-size:22px;font-weight:700;color:#722F37;margin:0;">
        $${totalClaimed.toLocaleString()} total declared value
      </p>
    </div>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0 0 16px;">
      We'll review your claim within <strong>3 business days</strong> and contact you with next steps.
    </p>
    <p style="font-size:13px;color:#888;margin:0;">
      Reference: ${claimNumber}
    </p>
  </div>
  <p style="text-align:center;font-size:11px;color:#aaa;margin-top:24px;">
    © ${new Date().getFullYear()} Yugo Moving · Toronto, ON
  </p>
</div>
</body>
</html>`;
}

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
      html: claimConfirmationHtml(claim.claim_number, clientName, items.length, totalClaimedValue),
    }).catch(() => {});

    notifyAdmins("quote_requested", {
      subject: `New Claim: ${claim.claim_number}`,
      body: `New damage claim from ${clientName}. ${items.length} item(s), $${totalClaimedValue.toLocaleString()} total. ${valuationTier || "released"} valuation.`,
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
