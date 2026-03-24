import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { normalizePhone } from "@/lib/phone";
import { hashCrewPin } from "@/lib/crew-token";
import { getResend } from "@/lib/resend";
import { crewPortalInviteEmail, crewPortalInviteEmailText } from "@/lib/email-templates";
import { getEmailFrom } from "@/lib/email/send";
import { clearLockout } from "@/lib/crew-lockout";

const CREW_MEMBERS_SELECT = "id, name, phone, email, role, team_id, is_active, avatar_initials, created_at";
const CREW_MEMBERS_SELECT_NO_EMAIL = "id, name, phone, role, team_id, is_active, avatar_initials, created_at";

/** GET: List crew members (admin only) */
export async function GET() {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const admin = createAdminClient();
  let result = await admin.from("crew_members").select(CREW_MEMBERS_SELECT).order("name");
  if (result.error && result.error.code === "PGRST204" && String(result.error.message).includes("email")) {
    result = await admin.from("crew_members").select(CREW_MEMBERS_SELECT_NO_EMAIL).order("name") as typeof result;
  }
  const { data: members, error } = result;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(members || []);
}

/** POST: Create crew member (admin only). Optionally send portal invite email when email is provided. */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const { name, phone, pin, role, team_id, email } = body;
    if (!name || !phone || !pin || !role || !team_id) {
      const err = "name, phone, pin, role, team_id required";
      console.error("[crew-members] 400:", err, { name: !!name, phone: !!phone, pin: !!pin, role: !!role, team_id: !!team_id });
      return NextResponse.json({ error: err }, { status: 400 });
    }
    const pinLength = 6;
    if (pin.length !== pinLength || !/^\d{6}$/.test(pin)) {
      const err = "PIN must be 6 digits";
      console.error("[crew-members] 400:", err);
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const normalizedPhone = normalizePhone(String(phone));
    if (normalizedPhone.length < 10) {
      const err = "Invalid phone number";
      console.error("[crew-members] 400:", err, { phone: String(phone).slice(0, 20), normalized: normalizedPhone });
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const emailTrimmed = typeof email === "string" ? email.trim() : "";
    if (emailTrimmed && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      const err = "Invalid email";
      console.error("[crew-members] 400:", err);
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const initials = (name || "")
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

    const admin = createAdminClient();

    const DUPLICATE_PHONE_MSG =
      "A portal access entry with this phone number already exists. Use a different number or update the existing member below.";

    const existingMemberId =
      typeof body.existing_member_id === "string" ? body.existing_member_id.trim() : "";

    /** When admin confirms, update this row instead of inserting (same phone). */
    if (existingMemberId) {
      const { data: target } = await admin
        .from("crew_members")
        .select("id, phone, name")
        .eq("id", existingMemberId)
        .maybeSingle();
      if (!target) {
        return NextResponse.json({ error: "Member not found" }, { status: 404 });
      }
      if (normalizePhone(String(target.phone)) !== normalizedPhone) {
        return NextResponse.json(
          { error: "Phone number does not match that crew member. Use the number already on file or choose another." },
          { status: 400 }
        );
      }

      const baseUpdate: Record<string, unknown> = {
        name: name.trim(),
        phone: normalizedPhone,
        pin_hash: hashCrewPin(pin),
        team_id,
        is_active: true,
        avatar_initials: initials || null,
        updated_at: new Date().toISOString(),
      };
      if (emailTrimmed) baseUpdate.email = emailTrimmed;

      let updateResult = await admin.from("crew_members").update(baseUpdate).eq("id", existingMemberId).select().single();
      if (updateResult.error && updateResult.error.code === "PGRST204" && String(updateResult.error.message).includes("email")) {
        delete baseUpdate.email;
        updateResult = await admin.from("crew_members").update(baseUpdate).eq("id", existingMemberId).select().single();
      }
      const { data: updated, error: updateErr } = updateResult;
      if (updateErr) {
        console.error("[crew-members] update existing error:", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      if (role === "lead") {
        const { data: teammates } = await admin
          .from("crew_members")
          .select("id")
          .eq("team_id", team_id)
          .eq("is_active", true);
        for (const t of teammates || []) {
          const newRole = t.id === existingMemberId ? "lead" : "specialist";
          await admin
            .from("crew_members")
            .update({ role: newRole, updated_at: new Date().toISOString() })
            .eq("id", t.id);
        }
      } else if (role === "specialist" || role === "driver") {
        await admin
          .from("crew_members")
          .update({ role, updated_at: new Date().toISOString() })
          .eq("id", existingMemberId);
      }

      const { data: finalRow } = await admin.from("crew_members").select().eq("id", existingMemberId).single();
      await clearLockout(normalizedPhone);

      const row = finalRow ?? updated;
      if (emailTrimmed && row) {
        try {
          const requestUrl = new URL(req.url);
          const origin = requestUrl.origin || (await import("@/lib/email-base-url")).getEmailBaseUrl();
          const loginUrl = `${origin.replace(/\/$/, "")}/crew/login`;
          const resend = getResend();
          const emailFrom = await getEmailFrom();
          await resend.emails.send({
            from: emailFrom,
            to: emailTrimmed,
            subject: "You're invited to the Yugo+ Crew Portal",
            html: crewPortalInviteEmail({
              name: row.name,
              email: emailTrimmed,
              loginUrl,
              phone: normalizedPhone,
              pin,
            }),
            text: crewPortalInviteEmailText({
              name: row.name,
              email: emailTrimmed,
              loginUrl,
              phone: normalizedPhone,
              pin,
            }),
          });
        } catch (err) {
          console.error("[crew-members] invite email send failed (update):", err);
        }
      }

      return NextResponse.json(row);
    }

    const { data: duplicate } = await admin
      .from("crew_members")
      .select("id, name")
      .eq("phone", normalizedPhone)
      .limit(1)
      .maybeSingle();
    if (duplicate) {
      console.error("[crew-members] 409: duplicate phone", { normalizedPhone });
      return NextResponse.json(
        {
          error: DUPLICATE_PHONE_MSG,
          code: "DUPLICATE_PHONE",
          existingMember: { id: duplicate.id, name: duplicate.name },
        },
        { status: 409 }
      );
    }

    const payload: Record<string, unknown> = {
      name: name.trim(),
      phone: normalizedPhone,
      pin_hash: hashCrewPin(pin),
      role: role,
      team_id,
      is_active: true,
      avatar_initials: initials || null,
    };
    if (emailTrimmed) payload.email = emailTrimmed;

    let result = await admin.from("crew_members").insert(payload).select().single();
    if (result.error && result.error.code === "PGRST204" && String(result.error.message).includes("email")) {
      delete payload.email;
      result = await admin.from("crew_members").insert(payload).select().single();
    }

    const { data, error } = result;
    if (!error && data && (role as string) === "lead" && team_id) {
      await admin
        .from("crew_members")
        .update({ role: "specialist", updated_at: new Date().toISOString() })
        .eq("team_id", team_id)
        .eq("role", "lead")
        .neq("id", data.id);
    }
    if (error) {
      console.error("[crew-members] insert error:", error);
      const isDuplicatePhone =
        String(error.code) === "23505" ||
        (error as { code?: string | number }).code === 23505 ||
        /duplicate key|unique constraint|already exists/i.test(String(error.message));
      if (isDuplicatePhone) {
        const { data: dup } = await admin
          .from("crew_members")
          .select("id, name")
          .eq("phone", normalizedPhone)
          .maybeSingle();
        return NextResponse.json(
          {
            error: DUPLICATE_PHONE_MSG,
            code: "DUPLICATE_PHONE",
            existingMember: dup ? { id: dup.id, name: dup.name } : undefined,
          },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (emailTrimmed && data) {
      try {
        // Use request origin so the link points to the same host (avoids 404 when env URL differs from deployment)
        const requestUrl = new URL(req.url);
        const origin = requestUrl.origin || (await import("@/lib/email-base-url")).getEmailBaseUrl();
        const loginUrl = `${origin.replace(/\/$/, "")}/crew/login`;
        const resend = getResend();
        const emailFrom = await getEmailFrom();
        await resend.emails.send({
          from: emailFrom,
          to: emailTrimmed,
          subject: "You're invited to the Yugo+ Crew Portal",
          html: crewPortalInviteEmail({
            name: data.name,
            email: emailTrimmed,
            loginUrl,
            phone: normalizedPhone,
            pin,
          }),
          text: crewPortalInviteEmailText({
            name: data.name,
            email: emailTrimmed,
            loginUrl,
            phone: normalizedPhone,
            pin,
          }),
        });
      } catch (err) {
        console.error("[crew-members] invite email send failed:", err);
        // Don't fail the request; member was created
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add crew member";
    console.error("[crew-members] POST error:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
