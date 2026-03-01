import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/partner-auth";

export async function POST(req: NextRequest) {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  try {
    const body = await req.json();
    const supabase = await createClient();

    const { data: org } = await supabase
      .from("organizations")
      .select("name, contact_name")
      .eq("id", orgId!)
      .single();

    const agentName = org?.contact_name || org?.name || "Partner Agent";
    const clientName = (body.client_name || "").trim();
    if (!clientName) return NextResponse.json({ error: "Client name is required" }, { status: 400 });

    const { data, error: dbError } = await supabase
      .from("referrals")
      .insert({
        agent_name: agentName,
        client_name: clientName,
        client_email: (body.client_email || "").trim() || null,
        property: (body.property || "").trim() || null,
        preferred_contact: (body.preferred_contact || "").trim() || null,
        move_type: (body.move_type || "").trim() || null,
        tier: body.tier || "standard",
        status: "new",
        commission: 0,
      })
      .select("id")
      .single();

    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create referral" },
      { status: 500 }
    );
  }
}
