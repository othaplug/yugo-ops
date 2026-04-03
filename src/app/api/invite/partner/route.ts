import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { invitePartnerEmail, invitePartnerEmailText } from "@/lib/email-templates";
import { requireAdmin } from "@/lib/api-auth";
import {
  VERTICAL_LABELS,
  augmentOrganizationsTypeCheckError,
  isAllowedOrganizationType,
  isPropertyManagementDeliveryVertical,
  normalizeOrganizationType,
  partnerHasSelfServePortal,
} from "@/lib/partner-type";
import { provisionPmPartnerPortfolio, type PmOnboardingInput } from "@/lib/partners/provision-pm-onboarding";
import { getEmailFrom } from "@/lib/email/send";
import { squareClient } from "@/lib/square";
import { upsertPartnerB2BVerticalsFromOnboarding } from "@/lib/partners/partner-b2b-verticals";
import { upsertHubSpotPartnerContact } from "@/lib/hubspot/upsert-partner-contact";

async function maybeProvisionPmPortfolio(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
  typeVal: string,
  rawPm: unknown,
  contractStatus: "draft" | "active"
) {
  if (!isPropertyManagementDeliveryVertical(typeVal) || !rawPm || typeof rawPm !== "object") return;
  const { count } = await admin
    .from("partner_contracts")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", orgId);
  if ((count ?? 0) > 0) return;

  const o = rawPm as Record<string, unknown>;
  const props = Array.isArray(o.properties) ? o.properties : [];
  const parsed: PmOnboardingInput = {
    properties: props
      .filter((p): p is Record<string, unknown> => p && typeof p === "object")
      .map((p) => ({
        building_name: String(p.building_name || "").trim(),
        address: String(p.address || "").trim(),
        postal_code: p.postal_code ? String(p.postal_code) : undefined,
        total_units: typeof p.total_units === "number" ? p.total_units : parseInt(String(p.total_units || ""), 10) || undefined,
        unit_types: Array.isArray(p.unit_types) ? (p.unit_types as string[]) : undefined,
        has_loading_dock: !!p.has_loading_dock,
        has_move_elevator: !!p.has_move_elevator,
        elevator_type: p.elevator_type ? String(p.elevator_type) : undefined,
        move_hours: String(p.move_hours || "").toLowerCase() === "custom" && p.custom_move_hours
          ? String(p.custom_move_hours).trim()
          : p.move_hours
            ? String(p.move_hours)
            : undefined,
        parking_type: p.parking_type ? String(p.parking_type) : undefined,
        building_contact_name: p.building_contact_name ? String(p.building_contact_name) : undefined,
        building_contact_phone: p.building_contact_phone ? String(p.building_contact_phone) : undefined,
        notes: p.notes ? String(p.notes) : undefined,
      })),
    contract_type:
      o.contract_type === "per_move" || o.contract_type === "day_rate_retainer"
        ? o.contract_type
        : "fixed_rate",
    start_date: String(o.start_date || "").slice(0, 10),
    end_date: String(o.end_date || "").slice(0, 10),
    auto_renew: !!o.auto_renew,
    tenant_comms_by: o.tenant_comms_by === "yugo" ? "yugo" : "partner",
    rate_card: o.rate_card && typeof o.rate_card === "object" ? (o.rate_card as Record<string, unknown>) : null,
    days_per_week: typeof o.days_per_week === "number" ? o.days_per_week : null,
    day_rate: typeof o.day_rate === "number" ? o.day_rate : null,
  };
  if (!parsed.start_date || !parsed.end_date) return;
  await provisionPmPartnerPortfolio(admin, orgId, parsed, contractStatus);
}

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
      create_portal_login, activation_mode,       send_setup_sms,
      // External IDs from dedup search
      hubspot_contact_id, square_customer_id, square_card_id,
      card_last_four, card_brand, card_on_file,
      pm_onboarding,
      b2b_delivery_verticals,
    } = body;

    if (!email || typeof email !== "string" || !name || typeof name !== "string") {
      return NextResponse.json({ error: "Company name and email are required" }, { status: 400 });
    }

    const emailTrimmed = email.trim().toLowerCase();
    const nameTrimmed = (name || "").trim();
    const contactNameTrimmed = (contact_name || "").trim();
    const phoneTrimmed = (phone || "").trim();
    const typeVal = normalizeOrganizationType(type);
    if (!isAllowedOrganizationType(typeVal)) {
      return NextResponse.json(
        { error: `Invalid partner vertical "${typeof type === "string" ? type.trim() : type}".` },
        { status: 400 },
      );
    }
    const wantsPortalLogin = partnerHasSelfServePortal(typeVal) && create_portal_login !== false;
    if (wantsPortalLogin && (!password || typeof password !== "string" || password.length < 8)) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
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

    let templateId = await resolveTemplateId(admin, template_slug || null);
    if (!templateId && isPropertyManagementDeliveryVertical(typeVal)) {
      templateId = await resolveTemplateId(admin, "property_management");
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
      vertical: typeVal,
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
        if (orgError) {
          return NextResponse.json({ error: augmentOrganizationsTypeCheckError(orgError.message) }, { status: 400 });
        }
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
        contactTitle: typeof contact_title === "string" ? contact_title.trim() : "",
        phone: phoneTrimmed,
        businessType: typeVal,
        existingHubspotContactId: hubspot_contact_id || null,
        existingSquareCustomerId: square_customer_id || null,
        admin,
      }).catch(() => {});
      await maybeProvisionPmPortfolio(admin, orgId, typeVal, pm_onboarding, isActivating ? "active" : "draft");
      await upsertPartnerB2BVerticalsFromOnboarding(admin, orgId, b2b_delivery_verticals);
      return NextResponse.json({ ok: true, message: "Partner saved as draft" });
    }

    const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existingUser =
      listData?.users?.find((u) => u.email?.toLowerCase() === emailTrimmed) ?? null;

    const upsertPartnerLink = async (uid: string, oid: string) => {
      await admin.from("partner_users").upsert(
        { user_id: uid, org_id: oid },
        { onConflict: "user_id,org_id" },
      );
    };

    const setAuthPasswordAndName = async (uid: string, meta: Record<string, unknown> | null | undefined) => {
      await admin.auth.admin.updateUserById(uid, {
        password,
        user_metadata: {
          ...(meta && typeof meta === "object" ? meta : {}),
          full_name: contactNameTrimmed || nameTrimmed,
          must_change_password: true,
        },
      });
    };

    if (existingOrg?.user_id) {
      if (!existingUser) {
        return NextResponse.json(
          {
            error:
              "This partner email is linked to a missing login account. Contact support or use a different email.",
          },
          { status: 400 },
        );
      }
      if (existingOrg.user_id !== existingUser.id) {
        return NextResponse.json(
          {
            error:
              "This email is already used for a different portal login. Use another email or update the existing partner.",
          },
          { status: 400 },
        );
      }
      userId = existingUser.id;
      await setAuthPasswordAndName(userId, existingUser.user_metadata as Record<string, unknown>);
      orgId = existingOrg.id;
      await admin.from("organizations").update({ user_id: userId, ...orgFields }).eq("id", orgId);
      await upsertPartnerLink(userId, orgId);
    } else if (existingOrg) {
      if (existingUser) {
        userId = existingUser.id;
        await setAuthPasswordAndName(userId, existingUser.user_metadata as Record<string, unknown>);
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
      }
      orgId = existingOrg.id;
      await admin.from("organizations").update({ user_id: userId, ...orgFields }).eq("id", orgId);
      await upsertPartnerLink(userId, orgId);
    } else {
      if (existingUser) {
        userId = existingUser.id;
        await setAuthPasswordAndName(userId, existingUser.user_metadata as Record<string, unknown>);
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
      }

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
        return NextResponse.json({ error: augmentOrganizationsTypeCheckError(orgError.message) }, { status: 400 });
      }
      orgId = newOrg!.id;
      await upsertPartnerLink(userId, orgId);
    }

    await maybeProvisionPmPortfolio(admin, orgId, typeVal, pm_onboarding, isActivating ? "active" : "draft");
    await upsertPartnerB2BVerticalsFromOnboarding(admin, orgId, b2b_delivery_verticals);

    // ── Sync to HubSpot / Square if not already linked ─────────────────────
    syncPartnerToExternal({
      orgId,
      email: emailTrimmed,
      name: nameTrimmed,
      contactName: contactNameTrimmed,
      contactTitle: typeof contact_title === "string" ? contact_title.trim() : "",
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
          [
            `Hi,`,
            `Welcome to Yugo.`,
            `Access your partner portal here:\n${loginUrl}`,
            `Login email: ${emailTrimmed}`,
          ].join("\n\n"),
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
  contactTitle,
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
  contactTitle: string;
  phone: string;
  businessType: string;
  existingHubspotContactId: string | null;
  existingSquareCustomerId: string | null;
  admin: ReturnType<typeof createAdminClient>;
}): Promise<void> {
  const updates: Record<string, unknown> = {};
  const token = process.env.HUBSPOT_ACCESS_TOKEN;

  // ── HubSpot: upsert when no pre-linked ID; refresh partner fields when linked ──
  if (token) {
    try {
      const nameParts = contactName.trim().split(/\s+/);
      const firstname = nameParts[0] ?? "";
      const lastname = nameParts.slice(1).join(" ") || undefined;
      const jobtitle = contactTitle.trim();

      if (existingHubspotContactId) {
        const patchRes = await fetch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${existingHubspotContactId}`,
          {
            method: "PATCH",
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
                ...(jobtitle ? { jobtitle } : {}),
                yugo_partner_status: "active",
                yugo_partner_type: businessType,
              },
            }),
          },
        );
        if (!patchRes.ok) {
          // ignore — non-critical
        }
      } else {
        const hsId = await upsertHubSpotPartnerContact(token, {
          email,
          firstname,
          lastname,
          company: name,
          phone,
          jobtitle: jobtitle || undefined,
          businessType,
        });
        if (hsId) updates.hubspot_contact_id = hsId;
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
