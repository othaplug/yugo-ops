import { NextRequest, NextResponse } from "next/server";
import { normalizeSlackSigningSecret, verifySlackRequest } from "@/lib/slack-signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type SlackMessageEvent = {
  type: string;
  channel?: string;
  user?: string;
  text?: string;
  ts?: string;
  bot_id?: string;
  username?: string;
  subtype?: string;
  thread_ts?: string;
};

/** GET — quick check that the route is deployed (Slack only uses POST). */
export async function GET() {
  return NextResponse.json(
    { ok: true, path: "/api/slack/events" },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(req: NextRequest) {
  const signingSecret = normalizeSlackSigningSecret(process.env.SLACK_SIGNING_SECRET);
  if (!signingSecret) {
    return NextResponse.json({ error: "SLACK_SIGNING_SECRET not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  const sig = req.headers.get("x-slack-signature");
  const ts = req.headers.get("x-slack-request-timestamp");

  if (!verifySlackRequest(signingSecret, rawBody, sig, ts)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: { type?: string; challenge?: string | number; event?: SlackMessageEvent; event_id?: string };
  try {
    payload = JSON.parse(rawBody) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type === "url_verification") {
    const ch = payload.challenge;
    if (ch === undefined || ch === null) {
      return NextResponse.json({ error: "Missing challenge" }, { status: 400 });
    }
    const challenge = typeof ch === "string" ? ch : String(ch);
    return NextResponse.json(
      { challenge },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  if (payload.type !== "event_callback" || !payload.event) {
    return NextResponse.json({ ok: true });
  }

  // Lazy-load DB + Slack API helpers so cold starts for URL verification stay small (<3s for Slack).
  const [
    { createAdminClient },
    {
      formatSlackMessageTextForDisplay,
      getSlackBotChannelConfig,
      resolveSlackUserDisplayNames,
      slackBotsInfo,
      slackUserIdsFromSlackText,
    },
  ] = await Promise.all([import("@/lib/supabase/admin"), import("@/lib/slack-bot")]);

  async function resolveSlackMessageAuthor(
    token: string,
    ev: SlackMessageEvent,
    nameByUserId: Map<string, string>
  ): Promise<{ author: string; isBot: boolean }> {
    const isBot = !!(ev.bot_id || ev.subtype === "bot_message");
    if (isBot) {
      if (ev.username?.trim()) return { author: ev.username.trim(), isBot: true };
      if (ev.user) {
        const n = nameByUserId.get(ev.user.toUpperCase());
        if (n) return { author: n, isBot: true };
      }
      if (ev.bot_id) {
        const info = await slackBotsInfo(token, ev.bot_id);
        return { author: info?.name ?? "Bot", isBot: true };
      }
      return { author: "Bot", isBot: true };
    }
    if (ev.user) {
      return { author: nameByUserId.get(ev.user.toUpperCase()) ?? ev.user, isBot: false };
    }
    return { author: "Slack", isBot: false };
  }

  const ev = payload.event;
  const cfg = getSlackBotChannelConfig();
  if (!cfg) return NextResponse.json({ ok: true });

  if (ev.type !== "message" || !ev.channel || !ev.ts) {
    return NextResponse.json({ ok: true });
  }

  if (ev.thread_ts && ev.thread_ts !== ev.ts) {
    return NextResponse.json({ ok: true });
  }

  if (ev.channel !== cfg.channel) {
    return NextResponse.json({ ok: true });
  }

  if (ev.subtype && ["message_changed", "message_deleted", "channel_join", "channel_leave", "pinned_item"].includes(ev.subtype)) {
    return NextResponse.json({ ok: true });
  }

  const textRaw = (ev.text || "").trim();
  if (!textRaw) {
    return NextResponse.json({ ok: true });
  }

  const userIds = new Set<string>();
  if (ev.user) userIds.add(ev.user.trim().toUpperCase());
  slackUserIdsFromSlackText(textRaw).forEach((id) => userIds.add(id));
  const nameByUserId = await resolveSlackUserDisplayNames(cfg.token, [...userIds]);
  const { author, isBot } = await resolveSlackMessageAuthor(cfg.token, ev, nameByUserId);
  const body = formatSlackMessageTextForDisplay(textRaw, nameByUserId);

  const admin = createAdminClient();
  const { error } = await admin.from("slack_message_events").insert({
    channel_id: ev.channel,
    ts: ev.ts,
    author,
    body,
    is_bot: isBot,
  });

  if (error && !/duplicate|unique/i.test(error.message)) {
    console.error("[slack/events] insert error", error.message);
  }

  return NextResponse.json({ ok: true });
}
