import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getResend } from "@/lib/resend";
import { referralReceivedEmail } from "@/lib/email-templates";

export async function POST(req: NextRequest) {
  try {
    const { agent_id, agent_name, brokerage, client_name, client_email, property, preferred_contact, move_type, tier, agent_email } = await req.json();

    const name = typeof agent_name === "string" ? agent_name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Agent name is required" }, { status: 400 });
    }

    const supabase = await createClient();
    const insert: Record<string, unknown> = {
      agent_id: agent_id || null,
      agent_name: name,
      brokerage: (brokerage || "").trim() || null,
      client_name: (client_name || "").trim() || null,
      client_email: (client_email || "").trim() || null,
      property: (property || "").trim() || null,
      preferred_contact: (preferred_contact || "").trim() || null,
      move_type: (move_type || "").trim() || null,
      tier: tier || "standard",
      status: "new",
      commission: 0,
    };

    const { data, error } = await supabase
      .from("referrals")
      .insert(insert)
      .select("id")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const emailToSend = (agent_email && typeof agent_email === "string" && agent_email.trim()) ? agent_email.trim() : null;
    if (emailToSend) {
      if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_your_api_key_here") {
        const resend = getResend();
        const html = referralReceivedEmail({
          agentName: name,
          clientName: client_name || "",
          property: property || "",
        });
        await resend.emails.send({
          from: "OPS+ <notifications@opsplus.co>",
          to: emailToSend,
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
