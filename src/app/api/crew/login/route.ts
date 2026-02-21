import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signCrewToken, hashCrewPin, CREW_COOKIE_NAME, CREW_PIN_LENGTH } from "@/lib/crew-token";
import { checkLockout, recordFailedAttempt, clearLockout, normalizePhoneForLockout } from "@/lib/crew-lockout";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function normalizePhone(phone: string): string {
  return normalizePhoneForLockout(phone);
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  let entry = rateLimitMap.get(key);
  if (!entry) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const phone = (body.phone || "").toString().trim();
    const pin = (body.pin || "").toString().trim();
    const crewMemberId = (body.crewMemberId || "").toString().trim();

    const isDeviceFlow = !!crewMemberId;

    if (isDeviceFlow) {
      if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
        return NextResponse.json({ error: "PIN must be 4–6 digits" }, { status: 400 });
      }
    } else {
      if (!phone || !pin) {
        return NextResponse.json({ error: "Phone and PIN required" }, { status: 400 });
      }
      const pinRegex = new RegExp(`^\\d{${CREW_PIN_LENGTH}}$`);
      if (pin.length !== CREW_PIN_LENGTH || !pinRegex.test(pin)) {
        return NextResponse.json({ error: `PIN must be ${CREW_PIN_LENGTH} digits` }, { status: 400 });
      }
    }

    const rateLimitKey = isDeviceFlow ? `crew:${crewMemberId}` : normalizePhone(phone);
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        { error: "Too many attempts. Try again in a minute." },
        { status: 429 }
      );
    }

    const supabase = createAdminClient();
    let member: { id: string; name: string; phone: string; pin_hash: string; role: string; team_id: string; avatar_initials?: string; pin_length?: number } | null = null;

    if (isDeviceFlow) {
      const { data: m, error } = await supabase
        .from("crew_members")
        .select("id, name, phone, pin_hash, role, team_id, avatar_initials, pin_length")
        .eq("id", crewMemberId)
        .eq("is_active", true)
        .maybeSingle();
      if (!error && m) member = m;
    } else {
      const normalized = normalizePhone(phone);
      const lockout = await checkLockout(phone);
      if (lockout.locked) {
        return NextResponse.json(
          {
            error: `Too many wrong PINs. Try again in ${lockout.retryAfterMinutes} minutes or contact dispatch to reset.`,
            retryAfterMinutes: lockout.retryAfterMinutes,
          },
          { status: 423 }
        );
      }
      if (normalized.length < 10) {
        return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
      }
      const { data: members, error } = await supabase
        .from("crew_members")
        .select("id, name, phone, pin_hash, role, team_id, avatar_initials, pin_length")
        .eq("is_active", true);
      member = !error && members
        ? members.find((m) => {
            const mNorm = (m.phone || "").replace(/\D/g, "").slice(-10);
            return mNorm === normalized || (m.phone || "").includes(normalized);
          }) ?? null
        : null;
    }

    if (!member) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const pinHash = hashCrewPin(pin);
    if (member.pin_hash !== pinHash) {
      if (!isDeviceFlow) await recordFailedAttempt(phone);
      return NextResponse.json({ error: "Invalid phone or PIN" }, { status: 401 });
    }

    if (!isDeviceFlow) await clearLockout(phone);

    const token = signCrewToken({
      crewMemberId: member.id,
      teamId: member.team_id,
      role: member.role,
      name: member.name,
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.set(CREW_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 12 * 3600,
      path: "/",
    });
    return res;
  } catch (e) {
    console.error("Crew login error:", e);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
