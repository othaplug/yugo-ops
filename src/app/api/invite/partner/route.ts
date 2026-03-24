import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { invitePartnerEmail, invitePartnerEmailText } from "@/lib/email-templates";
import { requireAdmin } from "@/lib/api-auth";
import { VERTICAL_LABELS } from "@/lib/partner-type";
import { getEmailFrom } from "@/lib/email/send";
import { squareClient } from "@/lib/square";

async function resolveTemplateId(admin: ReturnType<typeof createAdminClient>, templateSlug: string | null): Promise<string | null> {
  if (!templateSlug) return null;
  const { data } = await admin
    .from("rate_card_templates")
    .select("id")
    .eq("template_slug", templateSlug)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function POST(req: NextRequest) {
  const { error: authError } = await requireAdmin();
  if (authError) return authError;
  try {
    const body = await req.json();
    const {
      type, name, contact_name, email, phone, password, template_slug,
      // Extended onboarding fields
      legal_name, contact_title, address, website,
      how_found, referral_source, hubspot_deal_id,
      delivery_types, delivery_frequency, typical_items,
      special_requirements, preferred_windows, pickup_locations,
      billing_method, payment_terms, tax_id, insurance_cert_required,
      create_portal_login, activation_mode, send_setup_sms,
      // External IDs from dedup search
      hubspot_contact_id, square_customer_id, square_card_id,
      card_last_four, card_brand, card_on_file,
    } = body;

    if (!email || typeof email !== "string" || !name || typeof name !== "string") {
      return NextResponse.json({ error: "Company name and email are required" }, { status: 400 });
    }
    const wantsPortalLogin = create_portal_login !== false;
    if (wantsPortalLogin && (!password || typeof password !== "string" || password.length < 8)) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const nameTrimmed = (name || "").trim();
    const contactNameTrimmed = (contact_name || "").trim();
    const phoneTrimmed = (phone || "").trim();
    const typeVal = type || "furniture_retailer";
    const typeLabel = VERTICAL_LABELS[String(typeVal)] || typeVal;

    const admin = createAdminClient();

    // ── Duplicate guard: block if phone already in use by a different org ──
    if (phoneTrimmed) {
      const { data: phoneMatch } = await admin
        .from("organizations")
        .select("id, name, email")
        .neq("email", emailTrimmed)
        .eq("phone", phoneTrimmed)
        .limit(1)
        .maybeSingle();
      if (phoneMatch) {
        return NextResponse.json(
          { error: `A partner with this phone number already exists: "${phoneMatch.name}" (${phoneMatch.email})` },
          { status: 400 },
        );
      }
    }

    const templateId = await resolveTemplateId(admin, template_slug || null);

    // If email is already linked to a user, do not add again — return error
    const { data: existingAuthUsers } = await admin.auth.admin.listUsers();
    const existingUser = existingAuthUsers?.users?.find((u) => u.email?.toLowerCase() === emailTrimmed);
    if (existingUser) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 400 });
    }

    // Check if org with this email already exists (invited partner)
    const { data: existingOrg } = await admin
      .from("organizations")
      .select("id, user_id")
      .eq("email", emailTrimmed)
      .limit(1)
      .maybeSingle();

    let orgId: string;
    let userId: string;

    const isActivating = activation_mode === "activate" || activation_mode === "activate_welcome";
    const orgFields: Record<string, unknown> = {
      name: nameTrimmed,
      type: typeVal,
      contact_name: contactNameTrimmed,
      email: emailTrimmed,
      phone: phoneTrimmed,
      ...(templateId ? { template_id: templateId } : {}),
      // Extended onboarding fields
      ...(legal_name ? { legal_name: String(legal_name).trim() } : {}),
      ...(contact_title ? { contact_title: String(contact_title).trim() } : {}),
      ...(address ? { address: String(address).trim() } : {}),
      ...(website ? { website: String(website).trim() } : {}),
      ...(how_found ? { how_found: String(how_found) } : {}),
      ...(referral_source ? { referral_source: String(referral_source).trim() } : {}),
      ...(hubspot_deal_id ? { hubspot_deal_id: String(hubspot_deal_id).trim() } : {}),
      ...(Array.isArray(delivery_types) && delivery_types.length ? { delivery_types } : {}),
      ...(delivery_frequency ? { delivery_frequency: String(delivery_frequency) } : {}),
      ...(typical_items ? { typical_items: String(typical_items).trim() } : {}),
      ...(special_requirements ? { special_requirements: String(special_requirements).trim() } : {}),
      ...(preferred_windows ? { preferred_windows: String(preferred_windows) } : {}),
      ...(Array.isArray(pickup_locations) && pickup_locations.length ? { pickup_locations } : {}),
      billing_method: billing_method || "per_delivery",
      payment_terms: payment_terms || "net_30",
      ...(tax_id ? { tax_id: String(tax_id).trim() } : {}),
      ...(insurance_cert_required ? { insurance_cert_required: true } : {}),
      onboarding_status: isActivating ? "active" : "draft",
      ...(isActivating ? { activated_at: new Date().toISOString() } : {}),
      // External IDs from dedup search (pre-linked)
      ...(hubspot_contact_id ? { hubspot_contact_id: String(hubspot_contact_id) } : {}),
      ...(square_customer_id ? { square_customer_id: String(square_customer_id) } : {}),
      ...(square_card_id ? { square_card_id: String(square_card_id) } : {}),
      ...(card_last_four ? { card_last_four: String(card_last_four) } : {}),
      ...(card_brand ? { card_brand: String(card_brand) } : {}),
      ...(card_on_file ? { card_on_file: true } : {}),
    };

    if (!wantsPortalLogin) {
      // Create org without a portal user
      if (existingOrg) {
        orgId = existingOrg.id;
        await admin.from("organizations").update(orgFields).eq("id", orgId);
      } else {
        const { data: newOrg, error: orgError } = await admin
          .from("organizations")
          .insert({ ...orgFields, health: "good" })
          .select("id")
          .single();
        if (orgError) return NextResponse.json({ error: orgError.message }, { status: 400 });
        orgId = newOrg!.id;
      }
      // Update HubSpot deal if provided
      if (hubspot_deal_id) {
        const { syncDealStage } = await import("@/lib/hubspot/sync-deal-stage");
        syncDealStage(String(hubspot_deal_id), "partner_signed").catch(() => {});
      }
      syncPartnerToExternal({
        orgId,
        email: emailTrimmed,
        name: nameTrimmed,
        contactName: contactNameTrimmed,
        phone: phoneTrimmed,
        businessType: typeVal,
        existingHubspotContactId: hubspot_contact_id || null,
        existingSquareCustomerId: square_customer_id || null,
        admin,
      }).catch(() => {});
      return NextResponse.json({ ok: true, message: "Partner saved as draft" });
    }

    if (existingOrg?.user_id) {
      return NextResponse.json({ error: "A user with this email already exists." }, { status: 400 });
    } else if (existingOrg) {
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: emailTrimmed,
        password,
        email_confirm: true,
        user_metadata: { full_name: contactNameTrimmed || nameTrimmed, must_change_password: true },
      });
      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }
      userId = newUser.user.id;
      orgId = existingOrg.id;
      await admin
        .from("organizations")
        .update({ user_id: userId, ...orgFields })
        .eq("id", orgId);

      await admin.from("partner_users").upsert(
        { user_id: userId, org_id: orgId },
        { onConflict: "user_id" }
      );
    } else {
      const { data: newUser, error: createError } = await admin.auth.admin.createUser({
        email: emailTrimmed,
        password,
        email_confirm: true,
        user_metadata: { full_name: contactNameTrimmed || nameTrimmed, must_change_password: true },
      });
      if (createError) {
        return NextResponse.json({ error: createError.message }, { status: 400 });
      }
      userId = newUser.user.id;

      const { data: newOrg, error: orgError } = await admin
        .from("organizations")
        .insert({
          ...orgFields,
          health: "good",
          user_id: userId,
        })
        .select("id")
        .single();

      if (orgError) {
        return NextResponse.json({ error: orgError.message }, { status: 400 });
      }
      orgId = newOrg!.id;

      await admin.from("partner_users").insert({ user_id: userId, org_id: orgId });
    }

    // ── Sync to HubSpot / Square if not already linked ─────────────────────
    syncPartnerToExternal({
      orgId,
      email: emailTrimmed,
      name: nameTrimmed,
      contactName: contactNameTrimmed,
      phone: phoneTrimmed,
      businessType: typeVal,
      existingHubspotContactId: hubspot_contact_id || null,
      existingSquareCustomerId: square_customer_id || null,
      admin,
    }).catch(() => {});

    const { getEmailBaseUrl } = await import("@/lib/email-base-url");
    const loginUrl = `${getEmailBaseUrl()}/partner/login?welcome=1`;

    const inviteParams = { contactName: contactNameTrimmed, companyName: nameTrimmed, email: emailTrimmed, typeLabel, tempPassword: password, loginUrl };
    const resend = getResend();
    const emailFrom = await getEmailFrom();
    const { error: sendError } = await resend.emails.send({
      from: emailFrom,
      to: emailTrimmed,
      replyTo: emailFrom,
      subject: "Your Yugo partner portal is ready - complete your setup",
      html: invitePartnerEmail(inviteParams),
      text: invitePartnerEmailText(inviteParams),
      headers: {
        "Precedence": "auto",
        "X-Auto-Response-Suppress": "All",
      },
    });

    if (sendError) {
      return NextResponse.json({ error: sendError.message || "Failed to send invitation email" }, { status: 500 });
    }

    // Update HubSpot deal stage if provided
    if (hubspot_deal_id) {
      const { syncDealStage } = await import("@/lib/hubspot/sync-deal-stage");
      syncDealStage(String(hubspot_deal_id), "partner_signed").catch(() => {});
    }

    // Send SMS setup link if requested
    if (send_setup_sms && phoneTrimmed) {
      try {
        const { sendSMS } = await import("@/lib/sms/sendSMS");
        await sendSMS(
          phoneTrimmed,
          `Welcome to Yugo! Access your partner portal here: ${loginUrl}\nLogin: ${emailTrimmed}`
        );
      } catch {
        // Non-critical — don't fail the request
      }
    }

    return NextResponse.json({ ok: true, message: "Partner added and invitation sent" });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to send invitation" },
      { status: 500 }
    );
  }
}

/**
 * Fire-and-forget: create the partner as a HubSpot contact and Square customer
 * if they don't already have IDs linked.  Updates the organizations row with
 * the newly created external IDs.
 */
async function syncPartnerToExternal({
  orgId,
  email,
  name,
  contactName,
  phone,
  businessType,
  existingHubspotContactId,
  existingSquareCustomerId,
  admin,
}: {
  orgId: string;
  email: string;
  name: string;
  contactName: string;
  phone: string;
  businessType: string;
  existingHubspotContactId: string | null;
  existingSquareCustomerId: string | null;
  admin: ReturnType<typeof createAdminClient>;
}): Promise<void> {
  const updates: Record<string, unknown> = {};
  const token = process.env.HUBSPOT_ACCESS_TOKEN;

  // ── HubSpot ──────────────────────────────────────────────────────────────
  if (!existingHubspotContactId && token) {
    try {
      const nameParts = contactName.trim().split(/\s+/);
      const firstname = nameParts[0] ?? "";
      const lastname = nameParts.slice(1).join(" ") || undefined;

      const hsRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          properties: {
            email,
            firstname,
            ...(lastname ? { lastname } : {}),
            company: name,
            phone,
            yugo_partner_status: "active",
            yugo_partner_type: businessType,
          },
        }),
      });

      if (hsRes.ok) {
        const hsContact = await hsRes.json();
        if (hsContact.id) updates.hubspot_contact_id = hsContact.id;
      }
    } catch {
      // non-critical
    }
  }

  // ── Square ───────────────────────────────────────────────────────────────
  if (!existingSquareCustomerId) {
    try {
      const createRes = await squareClient.customers.create({
        companyName: name,
        emailAddress: email || undefined,
        phoneNumber: phone || undefined,
        referenceId: orgId,
      });
      const sqId = createRes.customer?.id;
      if (sqId) updates.square_customer_id = sqId;
    } catch {
      // non-critical
    }
  }

  if (Object.keys(updates).length > 0) {
    await admin.from("organizations").update(updates).eq("id", orgId);
  }
}
