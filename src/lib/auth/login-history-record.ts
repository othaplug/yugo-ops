import { createAdminClient } from "@/lib/supabase/admin"

export function parseDeviceFromUserAgent(ua: string | null): string {
  if (!ua) return "Unknown"
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS"
  if (/Android/i.test(ua)) return "Android"
  if (/Mac OS X/i.test(ua)) {
    if (/Chrome/i.test(ua)) return "Mac / Chrome"
    if (/Safari/i.test(ua)) return "Mac / Safari"
    if (/Firefox/i.test(ua)) return "Mac / Firefox"
    return "Mac"
  }
  if (/Windows/i.test(ua)) {
    if (/Chrome/i.test(ua)) return "Windows / Chrome"
    if (/Firefox/i.test(ua)) return "Windows / Firefox"
    if (/Edge/i.test(ua)) return "Windows / Edge"
    return "Windows"
  }
  if (/Linux/i.test(ua)) return "Linux"
  return "Browser"
}

export function getClientIpFromHeaders(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim()
    if (first) return first
  }
  return headers.get("x-real-ip")?.trim() || "-"
}

/**
 * Persists a successful sign-in row for Account settings → Login history.
 * Uses service role (RLS allows only service inserts on login_history).
 */
export async function recordLoginHistorySuccess(input: {
  userId: string
  headers: Headers
}): Promise<void> {
  try {
    const admin = createAdminClient()
    const ua = input.headers.get("user-agent")
    const { error } = await admin.from("login_history").insert({
      user_id: input.userId,
      device: parseDeviceFromUserAgent(ua),
      ip_address: getClientIpFromHeaders(input.headers),
      status: "success",
    })
    if (error) console.error("[login-history] insert failed:", error.message)
  } catch (e) {
    console.error("[login-history] record failed:", e)
  }
}
