/**
 * Slack Web API helpers for the configured bot + single channel (Messages page, track alerts).
 * Requires SLACK_BOT_TOKEN and SLACK_ADMIN_CHANNEL or SLACK_CHANNEL_ID.
 */

export function getSlackBotChannelConfig(): { token: string; channel: string } | null {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  const channel = (process.env.SLACK_ADMIN_CHANNEL || process.env.SLACK_CHANNEL_ID)?.trim();
  if (!token || !channel) return null;
  return { token, channel };
}

type SlackOk<T> = { ok: boolean; error?: string; needed?: string } & T;

/** Human-readable Slack Web API errors (esp. missing_scope). */
export function formatSlackApiError(data: { ok?: boolean; error?: string; needed?: string }): string {
  const code = data.error || "unknown_error";
  if (code === "missing_scope") {
    const hint = data.needed ? ` Slack reports needing: ${data.needed}.` : "";
    return (
      `Missing OAuth scope(s).${hint} Slack app → OAuth & Permissions → Scopes → Bot Token Scopes: add ` +
      `channels:history, channels:read, chat:write, users:read. If the channel is private, also add groups:history and groups:read. ` +
      `Save, then reinstall the app to your workspace and update SLACK_BOT_TOKEN with the new Bot User OAuth Token.`
    );
  }
  if (code === "not_allowed_token_type") {
    return "Wrong token type — use the Bot User OAuth Token (xoxb-…), not a user or legacy token.";
  }
  if (code === "not_in_channel") {
    return (
      "The bot is not a member of this channel. In Slack, open that channel, type /invite @ and pick your app’s bot, " +
      "or use /invite @YourBotDisplayName. For private channels the bot must be invited by a member. " +
      "Confirm SLACK_ADMIN_CHANNEL / SLACK_CHANNEL_ID matches that channel (C… for public, G… for private), then Refresh."
    );
  }
  if (code === "channel_not_found") {
    return "Channel not found or the bot isn’t a member. Invite the bot (/invite @YourApp) and verify SLACK_ADMIN_CHANNEL / SLACK_CHANNEL_ID.";
  }
  return code;
}

async function slackApi<T>(method: string, token: string, body: Record<string, unknown>): Promise<SlackOk<T>> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  return (await res.json()) as SlackOk<T>;
}

export type SlackHistoryMessage = {
  type?: string;
  user?: string;
  text?: string;
  ts?: string;
  bot_id?: string;
  username?: string;
  subtype?: string;
};

export async function slackConversationsHistory(
  token: string,
  channel: string,
  limit = 80
): Promise<{ messages: SlackHistoryMessage[]; error?: string }> {
  const data = await slackApi<{ messages?: SlackHistoryMessage[] }>("conversations.history", token, {
    channel,
    limit,
    inclusive: true,
  });
  if (!data.ok) {
    return { messages: [], error: formatSlackApiError(data) };
  }
  const messages = [...(data.messages ?? [])].sort(
    (a, b) => parseFloat(a.ts || "0") - parseFloat(b.ts || "0")
  );
  return { messages };
}

export async function slackChatPostMessage(token: string, channel: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const data = await slackApi<Record<string, never>>(token, "chat.postMessage", {
    channel,
    text,
    mrkdwn: true,
  });
  return { ok: !!data.ok, error: data.ok ? undefined : formatSlackApiError(data) };
}

export async function slackUsersInfo(token: string, user: string): Promise<{ name: string } | null> {
  const data = await slackApi<{ user?: { real_name?: string; profile?: { display_name?: string; real_name?: string } } }>(
    "users.info",
    token,
    { user }
  );
  if (!data.ok || !data.user) return null;
  const u = data.user;
  const name =
    u.real_name ||
    u.profile?.real_name ||
    u.profile?.display_name ||
    user;
  return { name };
}

export async function slackConversationsInfo(
  token: string,
  channel: string
): Promise<{ name: string | null }> {
  const data = await slackApi<{ channel?: { name?: string } }>("conversations.info", token, { channel });
  if (!data.ok || !data.channel?.name) return { name: null };
  return { name: data.channel.name };
}
