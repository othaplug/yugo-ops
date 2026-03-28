import type { SupabaseClient } from "@supabase/supabase-js";
import { sendSMS } from "@/lib/sms/sendSMS";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { notifyAdmins } from "@/lib/notifications/dispatch";

export type LeadRow = {
  id: string;
  lead_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  service_type?: string | null;
  move_size?: string | null;
  preferred_date?: string | null;
  source?: string | null;
  source_detail?: string | null;
  assigned_to?: string | null;
};

const SOURCE_LABELS: Record<string, string> = {
  website_form: "Website form",
  phone_call: "Phone",
  email: "Email",
  google_ads: "Google Ads",
  referral: "Referral",
  partner_referral: "Partner referral",
  realtor: "Realtor",
  walk_in: "Walk-in",
  social_media: "Social media",
  repeat_client: "Repeat client",
  other: "Other",
};

function sourceLabel(source: string | null | undefined, detail: string | null | undefined): string {
  const d = (detail || "").trim();
  if (d) return d;
  const s = (source || "").trim();
  return SOURCE_LABELS[s] || (s ? s.replace(/_/g, " ") : "Unknown");
}

async function phonesEmailsForUserIds(sb: SupabaseClient, userIds: string[]): Promise<{ userId: string; phone: string | null; email: string | null }[]> {
  const out: { userId: string; phone: string | null; email: string | null }[] = [];
  for (const uid of userIds) {
    const { data: pu } = await sb.from("platform_users").select("phone, email").eq("user_id", uid).maybeSingle();
    let email = pu?.email ?? null;
    let phone = pu?.phone ?? null;
    if (!email) {
      const { data: authUser } = await sb.auth.admin.getUserById(uid);
      email = authUser?.user?.email ?? null;
      phone = phone || authUser?.user?.phone || null;
    }
    out.push({ userId: uid, phone, email });
  }
  return out;
}

/** SMS + email to assigned rep(s) or all coordinators; in-app notify admins. */
export async function notifyLeadArrived(sb: SupabaseClient, lead: LeadRow): Promise<void> {
  const base = getEmailBaseUrl();
  const path = `/admin/leads/${lead.id}`;
  const url = `${base}${path}`;

  const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
  const svc = lead.service_type || "Move inquiry";
  const size = lead.move_size || "";
  const src = sourceLabel(lead.source, lead.source_detail);

  let recipientIds: string[] = [];
  if (lead.assigned_to) {
    recipientIds = [lead.assigned_to];
  } else {
    const { data: admins } = await sb
      .from("platform_users")
      .select("user_id")
      .in("role", ["owner", "admin", "manager", "coordinator", "sales"]);
    recipientIds = (admins || []).map((a) => a.user_id as string);
  }

  const contacts = await phonesEmailsForUserIds(sb, recipientIds);

  const smsLine =
    `NEW LEAD: ${name} | ${svc}${size ? ` | ${size}` : ""} | Source: ${src}. Respond ASAP → ${url}`;

  for (const c of contacts) {
    if (c.phone && c.phone.replace(/\D/g, "").length >= 10) {
      await sendSMS(c.phone, smsLine).catch(() => {});
    }
    if (c.email) {
      const body =
        `A new lead just came in. Respond within 5 minutes.\n\n` +
        `Name: ${name}\n` +
        `Service: ${svc}\n` +
        `Size: ${size || "—"}\n` +
        `Date: ${lead.preferred_date || "—"}\n` +
        `Source: ${src}\n\n` +
        `View: ${url}`;
      await sendEmail({
        to: c.email,
        subject: `New Lead: ${lead.first_name || "Inquiry"} — ${svc}`,
        html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap;">${body.replace(/</g, "&lt;")}</pre>`,
      }).catch(() => {});
    }
  }

  await notifyAdmins("lead_new", {
    subject: `New lead ${lead.lead_number || ""}`.trim(),
    description: `${name} · ${src}. ${url}`,
    sourceId: lead.id,
  }).catch(() => {});
}
