import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resend } from "@/lib/resend";

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
      const html = `
        <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto;">
          <h2 style="color: #E8E5E0;">Referral Received — Yugo OPS+</h2>
          <p style="color: #999;">Hi ${agent_name},</p>
          <p style="color: #999;">Your referral for <strong>${client_name || property || "this property"}</strong> has been received and added to our pipeline.</p>
          <p style="color: #999;">We'll be in touch as we process the lead.</p>
          <p style="color: #666; font-size: 12px;">Thank you for partnering with Yugo OPS+.</p>
        </div>
      `;
      if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_your_api_key_here") {
        await resend.emails.send({
          from: "Yugo OPS+ <notifications@yugo.ca>",
          to: agent_email.trim(),
          subject: "Referral received — Yugo OPS+",
          html,
        });
      }
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create referral" }, { status: 500 });
  }
}
