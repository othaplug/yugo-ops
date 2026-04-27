import type { SupabaseClient } from "@supabase/supabase-js";
import { newLeadAdminEmailHtml } from "@/lib/email/admin-templates";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { sendSMS } from "@/lib/sms/sendSMS";

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
  email?: string | null;
  phone?: string | null;
  from_address?: string | null;
  to_address?: string | null;
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
  manual: "Manual entry",
  other: "Other",
};

function sourceLabel(source: string | null | undefined, detail: string | null | undefined): string {
  const d = (detail || "").trim();
  if (d) return d;
  const s = (source || "").trim();
  return SOURCE_LABELS[s] || (s ? s.replace(/_/g, " ") : "Unknown");
}

function serviceLabelText(raw: string | null | undefined): string {
  const s = (raw || "").trim() || "Move inquiry";
  return s.replace(/_/g, " ");
}

function moveSizeLabelText(raw: string | null | undefined): string {
  const m = (raw || "").trim();
  if (!m) return "—";
  const map: Record<string, string> = {
    studio: "Studio",
    partial: "Partial move",
    "1br": "1 bedroom",
    "2br": "2 bedrooms",
    "3br": "3 bedrooms",
    "4br": "4 bedrooms",
    "4br_plus": "4+ bedrooms",
    "5br_plus": "5+ bedrooms",
  };
  return map[m] || m.replace(/_/g, " ");
}

function preferredDateText(raw: string | null | undefined): string {
  const t = (raw || "").trim();
  if (!t) return "—";
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    return t.slice(0, 10);
  }
  return t;
}

async function phonesEmailsForUserIds(
  sb: SupabaseClient,
  userIds: string[],
): Promise<{ userId: string; phone: string | null; email: string | null }[]> {
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
  const svc = serviceLabelText(lead.service_type);
  const sizeLabel = moveSizeLabelText(lead.move_size);
  const src = sourceLabel(lead.source, lead.source_detail);
  const dateLabel = preferredDateText(lead.preferred_date);
  const leadNo = (lead.lead_number || "").trim() || null;

  const contactEmail = (lead.email && String(lead.email).trim()) || null;
  const contactPhone = (lead.phone && String(lead.phone).trim()) || null;
  const fromAddress = (lead.from_address && String(lead.from_address).trim()) || null;
  const toAddress = (lead.to_address && String(lead.to_address).trim()) || null;

  const fullHtml = newLeadAdminEmailHtml({
    leadNumber: leadNo,
    clientName: name,
    serviceLabel: svc,
    moveSizeLabel: sizeLabel,
    preferredDateLabel: dateLabel,
    sourceLabel: src,
    leadUrl: url,
    contactEmail,
    contactPhone,
    fromAddress,
    toAddress,
  });

  const emailSubject = leadNo
    ? `New lead ${leadNo} · ${lead.first_name || "Inquiry"}`
    : `New lead: ${lead.first_name || name} · ${svc}`;

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
    `NEW LEAD: ${name} | ${svc}${lead.move_size ? ` | ${moveSizeLabelText(lead.move_size)}` : ""} | Source: ${src}. Respond ASAP -> ${url}`;

  for (const c of contacts) {
    if (c.phone && c.phone.replace(/\D/g, "").length >= 10) {
      await sendSMS(c.phone, smsLine).catch(() => {});
    }
    if (c.email) {
      await sendEmail({
        to: c.email,
        subject: emailSubject,
        html: fullHtml,
      }).catch(() => {});
    }
  }

  const descParts = [name, src, leadNo, url].filter(Boolean) as string[];
  await notifyAdmins("lead_new", {
    subject: leadNo ? `New lead ${leadNo}` : emailSubject,
    description: descParts.join(" · "),
    sourceId: lead.id,
    html: fullHtml,
  }).catch(() => {});
}
