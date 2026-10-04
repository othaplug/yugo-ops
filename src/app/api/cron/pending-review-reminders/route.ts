import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyAllAdmins } from "@/lib/notifications";
import { getAdminNotificationEmail } from "@/lib/config";
import { getResend } from "@/lib/resend";
import { getEmailFrom } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { formatJobId, getMoveCode } from "@/lib/move-code";

/**
 * Recurring "needs review" nudge. Client-submitted changes (extra items,
 * inventory changes, date/address changes) sit pending until an admin approves
 * or rejects them. The submit-time alert can be missed, so this cron re-surfaces
 * every STILL-pending request on an active (not completed/cancelled) move as a
 * single digest — one in-app notification + one email to admins — and keeps
 * nudging on each run until the request is actioned. Completed/cancelled moves
 * are excluded so we don't nag about history.
 *
 * Scheduled twice daily (vercel.json). Idempotent: it only reads state and sends
 * a digest; nothing is mutated, so a missed or double run is harmless.
 */

const TERMINAL_MOVE_STATUSES = new Set([
  "completed",
  "delivered",
  "cancelled",
  "canceled",
]);

type PendingRow = {
  moveId: string;
  moveCode: string;
  client: string;
  kind: string;
  detail: string;
  ageDays: number;
};

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((Date.now() - t) / 86_400_000));
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const pending: PendingRow[] = [];

  // Cache move lookups so we resolve each move once.
  const moveCache = new Map<
    string,
    { code: string; client: string; active: boolean } | null
  >();
  const resolveMove = async (moveId: string) => {
    if (moveCache.has(moveId)) return moveCache.get(moveId)!;
    const { data: m } = await admin
      .from("moves")
      .select("id, move_code, client_name, status")
      .eq("id", moveId)
      .maybeSingle();
    if (!m) {
      moveCache.set(moveId, null);
      return null;
    }
    const active = !TERMINAL_MOVE_STATUSES.has(String(m.status || "").toLowerCase());
    const resolved = {
      code: formatJobId(getMoveCode(m), "move"),
      client: m.client_name || "Client",
      active,
    };
    moveCache.set(moveId, resolved);
    return resolved;
  };

  // 1) Client-added extra items still pending.
  const { data: extras } = await admin
    .from("extra_items")
    .select("job_id, description, quantity, added_at")
    .eq("job_type", "move")
    .eq("requested_by", "client")
    .eq("status", "pending");
  for (const e of extras ?? []) {
    const m = await resolveMove(e.job_id as string);
    if (!m || !m.active) continue;
    const qty = Number(e.quantity) > 1 ? ` x${e.quantity}` : "";
    pending.push({
      moveId: e.job_id as string,
      moveCode: m.code,
      client: m.client,
      kind: "Extra item",
      detail: `${e.description}${qty}`,
      ageDays: daysSince(e.added_at as string),
    });
  }

  // 2) Inventory change requests still pending.
  const { data: icrs } = await admin
    .from("inventory_change_requests")
    .select("move_id, items_added, items_removed, submitted_at")
    .in("status", ["pending", "admin_reviewing", "client_confirming"]);
  for (const r of icrs ?? []) {
    const m = await resolveMove(r.move_id as string);
    if (!m || !m.active) continue;
    const added = Array.isArray(r.items_added) ? r.items_added.length : 0;
    const removed = Array.isArray(r.items_removed) ? r.items_removed.length : 0;
    pending.push({
      moveId: r.move_id as string,
      moveCode: m.code,
      client: m.client,
      kind: "Inventory change",
      detail: `+${added} / -${removed} item(s)`,
      ageDays: daysSince(r.submitted_at as string),
    });
  }

  // 3) Date/time/address/other change requests still pending.
  const { data: crs } = await admin
    .from("move_change_requests")
    .select("move_id, type, description, created_at")
    .eq("status", "pending");
  for (const r of crs ?? []) {
    const m = await resolveMove(r.move_id as string);
    if (!m || !m.active) continue;
    pending.push({
      moveId: r.move_id as string,
      moveCode: m.code,
      client: m.client,
      kind: r.type as string,
      detail: String(r.description || "").slice(0, 80),
      ageDays: daysSince(r.created_at as string),
    });
  }

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, pending: 0 });
  }

  pending.sort((a, b) => b.ageDays - a.ageDays);
  const oldest = pending[0];

  // In-app digest (one notification, links to the moves that need review).
  try {
    await notifyAllAdmins({
      title: `${pending.length} client request(s) awaiting review`,
      body: `Oldest: ${oldest.moveCode} (${oldest.client}), ${oldest.kind} waiting ${oldest.ageDays} day(s). Approve or reject in the move.`,
      icon: "clipboard",
      link: oldest.moveCode ? `/admin/moves/${oldest.moveId}` : "/admin/moves",
      eventSlug: "pending_review_reminder",
      sourceType: "move",
      sourceId: oldest.moveId,
    });
  } catch {
    /* non-fatal */
  }

  // Email digest to the admin notification inbox.
  if (process.env.RESEND_API_KEY) {
    try {
      const to = (await getAdminNotificationEmail()).trim();
      if (to) {
        const base = getEmailBaseUrl().replace(/\/$/, "");
        const rows = pending
          .slice(0, 50)
          .map(
            (p) =>
              `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px">` +
              `<a href="${base}/admin/moves/${p.moveId}">${p.moveCode}</a></td>` +
              `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px">${p.client}</td>` +
              `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px">${p.kind}: ${p.detail}</td>` +
              `<td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:right">${p.ageDays}d</td></tr>`,
          )
          .join("");
        const html =
          `<div style="font-family:Arial,sans-serif;color:#2C3E2D">` +
          `<h2 style="font-size:18px">${pending.length} client request(s) awaiting review</h2>` +
          `<p style="font-size:13px;color:#555">These were submitted from client portals and still need an approve or reject. Active moves only.</p>` +
          `<table style="width:100%;border-collapse:collapse"><thead><tr>` +
          `<th style="text-align:left;padding:6px 10px;font-size:11px;color:#888">MOVE</th>` +
          `<th style="text-align:left;padding:6px 10px;font-size:11px;color:#888">CLIENT</th>` +
          `<th style="text-align:left;padding:6px 10px;font-size:11px;color:#888">REQUEST</th>` +
          `<th style="text-align:right;padding:6px 10px;font-size:11px;color:#888">AGE</th>` +
          `</tr></thead><tbody>${rows}</tbody></table></div>`;
        const resend = getResend();
        await resend.emails.send({
          from: await getEmailFrom(),
          to,
          subject: `${pending.length} client request(s) awaiting review`,
          html,
          headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
        });
      }
    } catch (err) {
      console.error("[pending-review-reminders] email failed", err);
    }
  }

  return NextResponse.json({ ok: true, pending: pending.length });
}
