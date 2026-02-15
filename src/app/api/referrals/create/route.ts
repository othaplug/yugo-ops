import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResend } from "@/lib/resend";
import { referralReceivedEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const { agent_name, brokerage, client_name, property, tier, agent_email } = await req.json();

    if (!agent_name || typeof agent_name !== "string") {
      return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("referrals")
      .insert({
        agent_name: agent_name.trim(),
        brokerage: (brokerage || "").trim(),
        client_name: (client_name || "").trim(),
        property: (property || "").trim(),
        tier: tier || "standard",
        status: "new",
        commission: 0,
      })
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (agent_email && typeof agent_email === "string" && agent_email.trim()) {
      if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_your_api_key_here") {
        const resend = getResend();
        const html = referralReceivedEmail({
          agentName: agent_name.trim(),
          clientName: client_name || "",
          property: property || "",
        });
        await resend.emails.send({
          from: "OPS+ <notifications@opsplus.co>",
          to: agent_email.trim(),
          subject: "Referral received — OPS+",
          html,
          headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
        });
      }
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create referral" }, { status: 500 });
  }
}
