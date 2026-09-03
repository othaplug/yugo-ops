/**
 * PM daily digest cron.
 *
 * Runs once each morning ET. For every property_manager organization
 * with at least one move scheduled TODAY at a building it operates,
 * sends one consolidated email listing those moves. Replaces the four
 * mid-move progress emails PMs used to receive per move (booking +
 * completion emails still fire as-is; this fills the middle with a
 * single planning-friendly digest).
 *
 * Timezone: uses America/Toronto for "today" — moves are scheduled
 * in ET, so this matches how operators + PMs think about the day.
 *
 * Dedup: writes a notification_log row per (org, date) with
 * notification_key = "org:{orgId}:pm_digest:{YYYY-MM-DD}" so a retry
 * or double-fire hits the unique index at migration
 * 20260724150000_notification_log_dedup_key.sql.
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { partnerPropertyManagerDailyDigestEmail } from "@/lib/email-templates";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // "Today" in Toronto — a move scheduled for 2026-08-01 shows up in
  // the digest fired between 00:00 and 23:59 ET on 2026-08-01.
  const todayET = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Toronto",
  });
  const dateLabel = new Date(`${todayET}T12:00:00`).toLocaleDateString(
    "en-CA",
    { weekday: "long", month: "long", day: "numeric", timeZone: "America/Toronto" },
  );

  // Pull all moves scheduled today with a property_manager org attached.
  // Joining organizations here so we can filter type = property_manager
  // in one round-trip; excludes moves whose org is a corporate account
  // or referral partner (those keep the existing partner behavior).
  const { data: moves, error: mErr } = await admin
    .from("moves")
    .select(
      "id, move_code, client_name, scheduled_date, scheduled_time, arrival_window, from_address, to_address, organization_id, status, organizations!inner(id, email, name, type)",
    )
    .eq("scheduled_date", todayET)
    .eq("organizations.type", "property_manager")
    .not("status", "in", "('cancelled','archived')");

  if (mErr) {
    console.error("[pm-daily-digest] query failed:", mErr.message);
    return NextResponse.json({ error: mErr.message }, { status: 500 });
  }

  type OrgRow = { id: string; email: string | null; name: string | null };
  type MoveRow = {
    id: string;
    move_code: string | null;
    client_name: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    arrival_window: string | null;
    from_address: string | null;
    to_address: string | null;
    organization_id: string | null;
    organizations: OrgRow | OrgRow[] | null;
  };

  // Group by org — one email per org, all moves for that org listed.
  const byOrg = new Map<
    string,
    { org: OrgRow; moves: MoveRow[] }
  >();
  for (const raw of (moves ?? []) as MoveRow[]) {
    const orgRel = raw.organizations;
    const org: OrgRow | null = Array.isArray(orgRel)
      ? orgRel[0] ?? null
      : orgRel ?? null;
    if (!org || !org.email) continue;
    const entry = byOrg.get(org.id) ?? { org, moves: [] };
    entry.moves.push(raw);
    byOrg.set(org.id, entry);
  }

  let sent = 0;
  let skippedDupe = 0;
  const failures: Array<{ orgId: string; error: string }> = [];

  for (const { org, moves: orgMoves } of byOrg.values()) {
    const notificationKey = `org:${org.id}:pm_digest:${todayET}`;

    // Reserve first — same pattern as sendClientTrackingCheckpointSms.
    // On 23505 (unique conflict) another run already sent today's
    // digest for this org and we skip silently.
    const { data: reserved, error: reserveErr } = await admin
      .from("notification_log")
      .insert({
        channel: "email",
        event: "pm_daily_digest",
        recipient_email: org.email,
        message: `PM daily digest for ${todayET} (${orgMoves.length} moves)`,
        status: "pending",
        notification_key: notificationKey,
      })
      .select("id")
      .single();
    if (reserveErr || !reserved) {
      if ((reserveErr as { code?: string } | null)?.code === "23505") {
        skippedDupe++;
        continue;
      }
      failures.push({
        orgId: org.id,
        error: reserveErr?.message ?? "reserve failed",
      });
      continue;
    }

    const digestMoves = orgMoves.map((m) => {
      const when =
        [m.scheduled_time || m.arrival_window].filter(Boolean).join(" · ") ||
        "Time TBD";
      return {
        moveCode: m.move_code || m.id,
        customerName: (m.client_name || "Resident").trim(),
        whenLabel: when,
        fromAddress: m.from_address,
        toAddress: m.to_address,
      };
    });

    const html = partnerPropertyManagerDailyDigestEmail({
      dateLabel,
      moves: digestMoves,
    });

    try {
      await sendEmail({
        to: org.email!,
        subject: `Today's Yugo activity at your properties`,
        html,
      });
      await admin
        .from("notification_log")
        .update({ status: "sent" })
        .eq("id", reserved.id);
      sent++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "send failed";
      // DELETE the reservation (not mark it 'failed') so its unique
      // notification_key is released. Keeping the row meant the next run's
      // reservation hit 23505 → skippedDupe, and the org never got that day's
      // digest even though the send had failed. Deleting lets a later run
      // re-reserve and retry.
      await admin.from("notification_log").delete().eq("id", reserved.id);
      failures.push({ orgId: org.id, error: msg });
    }
  }

  return NextResponse.json({
    date: todayET,
    orgs_with_activity: byOrg.size,
    sent,
    skipped_duplicate: skippedDupe,
    failed: failures.length,
    failures,
  });
}
