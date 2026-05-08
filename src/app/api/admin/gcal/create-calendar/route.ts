import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { callGCal, setGCalIdOverride } from "@/lib/google-calendar/client";

/**
 * POST /api/admin/gcal/create-calendar
 *
 * Workaround for Google Workspace orgs that block "Make changes to events" on
 * external service accounts: have the service account create its own calendar
 * via the Calendar API. The service account becomes the OWNER and has full
 * write access without needing any admin sharing policy changes.
 *
 * Optional body: { summary?: string; shareWithEmails?: string[] }
 *   - summary: defaults to "Yugo OPS+ Jobs"
 *   - shareWithEmails: list of emails to grant Reader access via ACL so the
 *     team can see the calendar in their Google Calendar UI
 *
 * The new calendar ID is persisted to platform_config (key: gcal_calendar_id)
 * and applied as a runtime override so subsequent syncs use it immediately.
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  let body: { summary?: string; shareWithEmails?: string[] } = {};
  try {
    body = await req.json();
  } catch {
    /* no body */
  }

  const summary = (body.summary?.trim() || "Yugo OPS+ Jobs").slice(0, 200);
  const shareList = (body.shareWithEmails ?? [])
    .map((s) => String(s).trim().toLowerCase())
    .filter((s) => /\S+@\S+\.\S+/.test(s));

  // Step 1: create the calendar (service account becomes owner)
  const create = await callGCal<{ id: string; summary: string }>(
    "/calendars",
    "POST",
    {
      summary,
      timeZone: "America/Toronto",
      description:
        "Auto-created by Yugo OPS+. Owned by the OPS+ service account so " +
        "writes work without external-sharing permission.",
    },
  );

  if (!create.ok || !create.data?.id) {
    return NextResponse.json(
      {
        success: false,
        error: create.error ?? `HTTP ${create.status}`,
        hint:
          "Service account could not create a calendar. Verify the service " +
          "account exists and the Calendar API is enabled in its Google Cloud project.",
      },
      { status: 502 },
    );
  }

  const newCalendarId = create.data.id;

  // Step 2: grant Reader access to each requested email so they can see the
  // calendar in their Google Calendar UI. Reader access is allowed even under
  // restrictive Workspace policies (it's only "Make changes" that's blocked).
  const aclResults: { email: string; ok: boolean; error?: string }[] = [];
  for (const email of shareList) {
    const acl = await callGCal(
      `/calendars/${encodeURIComponent(newCalendarId)}/acl`,
      "POST",
      {
        role: "reader",
        scope: { type: "user", value: email },
      },
    );
    aclResults.push({
      email,
      ok: acl.ok,
      error: acl.ok ? undefined : (acl.error ?? `HTTP ${acl.status}`),
    });
  }

  // Step 3: persist to platform_config so the change survives restarts and is
  // visible across all server instances. Set the runtime override so this
  // request's caller (and immediate follow-up syncs in this process) pick it up.
  const db = createAdminClient();
  await db
    .from("platform_config")
    .upsert({ key: "gcal_calendar_id", value: newCalendarId });
  setGCalIdOverride(newCalendarId);

  return NextResponse.json({
    success: true,
    calendarId: newCalendarId,
    summary: create.data.summary,
    sharedWith: aclResults,
  });
}
