import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import {
  escapeSlackMrkdwnSegment,
  formatSlackMessageTextForDisplay,
  getSlackBotChannelConfig,
  resolveSlackBotDisplayNames,
  resolveSlackUserDisplayNames,
  slackChatPostMessage,
  slackConversationsHistory,
  slackConversationsInfo,
  slackUserIdsFromSlackText,
} from "@/lib/slack-bot";

export async function GET() {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const cfg = getSlackBotChannelConfig();
  if (!cfg) {
    return NextResponse.json(
      { configured: false as const, error: "Set SLACK_BOT_TOKEN and SLACK_ADMIN_CHANNEL (or SLACK_CHANNEL_ID) in the server environment." },
      { status: 200 }
    );
  }

  const { token, channel } = cfg;
  const [{ messages, error: histErr }, { name: channelName }] = await Promise.all([
    slackConversationsHistory(token, channel, 100),
    slackConversationsInfo(token, channel),
  ]);

  if (histErr) {
    return NextResponse.json(
      { configured: true as const, channelName, channelId: channel, error: histErr, messages: [] },
      { status: 200 }
    );
  }

  const userIdSet = new Set<string>();
  for (const m of messages) {
    if (m.user) userIdSet.add(m.user.trim().toUpperCase());
    slackUserIdsFromSlackText(m.text || "").forEach((id) => userIdSet.add(id));
  }
  const nameByUserId = await resolveSlackUserDisplayNames(token, [...userIdSet]);

  const botIdsForNames = [
    ...new Set(
      messages.filter((m) => m.bot_id && !m.user && !m.username).map((m) => m.bot_id as string)
    ),
  ];
  const botNameById = await resolveSlackBotDisplayNames(token, botIdsForNames);

  const items = messages.map((m) => {
    const raw = m.text || "";
    let displayText = formatSlackMessageTextForDisplay(raw, nameByUserId);
    if (!displayText.trim() && m.subtype === "channel_join" && m.user) {
      const who = nameByUserId.get(m.user.toUpperCase()) || m.user;
      displayText = `${who} joined the channel`;
    } else if (!displayText.trim() && m.subtype === "channel_leave" && m.user) {
      const who = nameByUserId.get(m.user.toUpperCase()) || m.user;
      displayText = `${who} left the channel`;
    }
    let author = "Slack";
    if (m.user) author = nameByUserId.get(m.user.toUpperCase()) || m.user;
    else if (m.username) author = m.username;
    else if (m.bot_id) author = botNameById.get(m.bot_id) || "Bot";
    return {
      ts: m.ts || "",
      author,
      text: displayText,
      isBot: !!(m.bot_id || m.subtype === "bot_message"),
    };
  });

  return NextResponse.json({
    configured: true as const,
    channelName: channelName ? `#${channelName}` : null,
    channelId: channel,
    messages: items,
  });
}

export async function POST(req: NextRequest) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const cfg = getSlackBotChannelConfig();
  if (!cfg) {
    return NextResponse.json({ error: "Slack is not configured for this deployment." }, { status: 503 });
  }

  let body: { text?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const text = (body.text || "").trim();
  if (!text || text.length > 4000) {
    return NextResponse.json({ error: "Message is required (max 4000 characters)." }, { status: 400 });
  }

  const sender =
    (user.user_metadata?.full_name as string | undefined)?.trim() ||
    user.email?.split("@")[0] ||
    "Staff";

  const payload = `*${escapeSlackMrkdwnSegment(sender)}* (Yugo)\n${text}`;
  const result = await slackChatPostMessage(cfg.token, cfg.channel, payload);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || "Failed to post to Slack" },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
