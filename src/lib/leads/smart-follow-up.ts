import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/sms/sendSMS";
import { sendEmail } from "@/lib/email/send";
import type { CompletenessCheck } from "./assess-completeness";

const COORD_PHONE_DISPLAY = "(647) 370-4525";

export function buildSmartFollowUpQuestions(completeness: CompletenessCheck): string[] {
  const missingQuestions: string[] = [];

  for (const item of completeness.missing) {
    switch (item) {
      case "to_address":
        missingQuestions.push("What is the delivery or destination address?");
        break;
      case "from_address":
        missingQuestions.push("What is the pickup address?");
        break;
      case "preferred_date":
        missingQuestions.push("What date works best for you?");
        break;
      case "move_size":
        missingQuestions.push(
          "How many bedrooms is the home? (Or describe the scope of work.)",
        );
        break;
      case "inventory — no items provided":
        missingQuestions.push(
          "Could you list the main furniture items? (Sofas, beds, tables, etc.)",
        );
        break;
      case "name":
        missingQuestions.push("What name should we use for your quote?");
        break;
      default:
        if (item.startsWith("contact")) {
          missingQuestions.push("What is the best email or phone number to reach you?");
        }
        break;
    }
  }

  for (const clarification of completeness.clarifications_needed) {
    if (clarification.includes("Multiple dates")) {
      missingQuestions.push(
        "You mentioned more than one date. Could you confirm the schedule and what needs to happen on each day?",
      );
    }
    if (clarification.includes("same address")) {
      missingQuestions.push(
        "Pickup and delivery look like the same address. Is this furniture rearrangement in one space, or a move between units?",
      );
    }
    if (clarification.includes("Service type")) {
      missingQuestions.push(
        "To give you the most accurate quote, could you describe what you need? (Move between addresses, in-home rearrangement, event logistics, single-item delivery, etc.)",
      );
    }
  }

  return [...new Set(missingQuestions)];
}

type LeadOutreachRow = {
  id: string;
  first_name: string | null;
  email: string | null;
  phone: string | null;
};

/**
 * Sends targeted questions via SMS and/or email, then updates the lead row and activity log.
 */
export async function sendSmartFollowUp(
  sb: SupabaseClient,
  lead: LeadOutreachRow,
  completeness: CompletenessCheck,
): Promise<boolean> {
  const missingQuestions = buildSmartFollowUpQuestions(completeness);
  if (missingQuestions.length === 0) return false;

  const first = (lead.first_name || "there").trim() || "there";

  const emailHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body class="email-outer-gutter" style="font-family:system-ui,sans-serif;line-height:1.5;color:#1a1a1a;width:100%;max-width:600px;box-sizing:border-box;margin:0 auto;padding:16px 20px;">
  <p>Hi ${first.replace(/</g, "&lt;")},</p>
  <p>Thanks for reaching out to Yugo. We would like to get your personalized quote ready.</p>
  <p>To make sure we give you the most accurate price, we need a few details:</p>
  <ol style="padding-left:20px;">${missingQuestions.map((q) => `<li style="margin-bottom:8px;">${q.replace(/</g, "&lt;")}</li>`).join("")}</ol>
  <p>Simply reply to this email or text us at ${COORD_PHONE_DISPLAY} and we will have your quote ready within the hour.</p>
  <p style="margin-top:24px;">— The Yugo Team</p>
</body></html>`;

  const phoneOk = lead.phone && lead.phone.replace(/\D/g, "").length >= 10;
  const emailOk = lead.email && lead.email.includes("@");

  if (phoneOk) {
    const smsText =
      missingQuestions.length <= 2
        ? `Hi ${first}, thanks for reaching out to Yugo! To get your quote ready: ${missingQuestions[0]!}${missingQuestions[1] ? ` Also: ${missingQuestions[1]}` : ""} — The Yugo Team`
        : `Hi ${first}, thanks for reaching out to Yugo! We have a few quick questions to finalize your quote. Check your email for details. — The Yugo Team`;
    await sendSMS(lead.phone!, smsText).catch((e) => console.warn("[leads] smart follow-up SMS:", e));
  }

  if (emailOk) {
    await sendEmail({
      to: lead.email!.trim(),
      subject: "Quick questions about your move — Yugo",
      html: emailHtml,
    }).catch((e) => console.warn("[leads] smart follow-up email:", e));
  }

  if (!phoneOk && !emailOk) return false;

  const now = new Date().toISOString();
  await sb
    .from("leads")
    .update({
      status: "follow_up_sent",
      follow_up_questions: missingQuestions,
      follow_up_sent_at: now,
    })
    .eq("id", lead.id);

  await sb.from("lead_activities").insert({
    lead_id: lead.id,
    activity_type: "follow_up_sent",
    performed_by: null,
    notes: `Smart follow-up: ${missingQuestions.length} question(s)`,
  });

  return true;
}
