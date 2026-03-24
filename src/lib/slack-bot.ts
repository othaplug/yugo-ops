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
      `channels:history, channels:read, chat:write, users:read, bots:read. If the channel is private, also add groups:history and groups:read. ` +
      `Save, then reinstall the app to your workspace and update SLACK_BOT_TOKEN with the new Bot User OAuth Token.`
    );
  }
  if (code === "not_allowed_token_type") {
    return "Wrong token type, use the Bot User OAuth Token (xoxb-…), not a user or legacy token.";
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

/** Slack UI-style label: profile display name when set, else real name / username. */
export async function slackUsersInfo(token: string, user: string): Promise<{ name: string } | null> {
  const data = await slackApi<{
    user?: {
      name?: string;
      real_name?: string;
      profile?: { display_name?: string; real_name?: string };
    };
  }>("users.info", token, { user });
  if (!data.ok || !data.user) return null;
  const u = data.user;
  const display = u.profile?.display_name?.trim();
  const name =
    (display && display.length > 0 ? display : null) ||
    u.real_name?.trim() ||
    u.profile?.real_name?.trim() ||
    u.name?.trim() ||
    user;
  return { name };
}

export async function slackBotsInfo(token: string, bot: string): Promise<{ name: string } | null> {
  const data = await slackApi<{ bot?: { name?: string } }>("bots.info", token, { bot });
  if (!data.ok || !data.bot?.name) return null;
  return { name: data.bot.name };
}

/** Decode HTML entities so Slack mrkdwn (e.g. &lt;tel:…&gt;) can be parsed. Iterates for double-encoded content. */
export function decodeHtmlEntities(text: string): string {
  let t = text;
  let prev = "";
  while (t !== prev) {
    prev = t;
    t = t.replace(/&amp;/g, "&");
    t = t.replace(/&lt;/g, "<");
    t = t.replace(/&gt;/g, ">");
    t = t.replace(/&quot;/g, '"');
    t = t.replace(/&#39;/g, "'");
    t = t.replace(/&#x27;/gi, "'");
    t = t.replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));
    t = t.replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
  }
  return t;
}

/**
 * Slack user / workspace IDs in text: <@U…>, <@W…>, and bare @U… / @W… (e.g. join messages).
 * Run on HTML-decoded text (this function decodes first).
 */
export function slackUserIdsFromSlackText(text: string): string[] {
  const t = decodeHtmlEntities(text);
  const ids = new Set<string>();
  const angled = /<@([UW][A-Za-z0-9]+)(?:\|[^>]*)?>/g;
  let m: RegExpExecArray | null;
  while ((m = angled.exec(t)) !== null) {
    ids.add(m[1].toUpperCase());
  }
  const bare = /@([UW][A-Za-z0-9]{8,22})\b/g;
  while ((m = bare.exec(t)) !== null) {
    const id = m[1].toUpperCase();
    if (!/^(CHANNEL|HERE|EVERYONE)$/.test(id)) ids.add(id);
  }
  return [...ids];
}

/** @deprecated Use slackUserIdsFromSlackText */
export const slackUserIdsFromMentions = slackUserIdsFromSlackText;

/**
 * Human-readable message text for admin UI: @display names, broadcast aliases, labeled links.
 */
export function formatSlackMessageTextForDisplay(text: string, nameByUserId: Map<string, string>): string {
  let t = decodeHtmlEntities(text);
  t = t.replace(/<tel:([^|>]+)\|([^>]+)>/g, "$2");
  t = t.replace(/<tel:([^>]+)>/g, "$1");
  t = t.replace(/<mailto:([^|>]+)\|([^>]+)>/g, "$2");
  t = t.replace(/<mailto:([^>]+)>/g, "$1");
  t = t.replace(/<@([UW][A-Za-z0-9]+)(?:\|[^>]*)?>/g, (_full, id: string) => {
    const n = nameByUserId.get(id);
    return n ? `@${n}` : `@${id}`;
  });
  t = t.replace(/<!channel>/gi, "@channel");
  t = t.replace(/<!here>/gi, "@here");
  t = t.replace(/<!everyone>/gi, "@everyone");
  t = t.replace(/<!subteam\^[A-Z0-9]+(?:\|([^>]+))?>/g, (_full, label?: string) =>
    label?.trim() ? `@${label.trim()}` : "@usergroup"
  );
  t = t.replace(/<(https?:[^|>]+)\|([^>]+)>/g, "$2");
  t = t.replace(/<(https?:[^>]+)>/g, "$1");
  t = t.replace(/@(?<![A-Za-z0-9])([UW][A-Za-z0-9]{8,22})\b/g, (full, id: string) => {
    const key = id.toUpperCase();
    const n = nameByUserId.get(key);
    return n ? `@${n}` : full;
  });
  return t;
}

/** Escape text so it can be wrapped in Slack mrkdwn *bold* without breaking formatting. */
export function escapeSlackMrkdwnSegment(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\*/g, "\\*").replace(/_/g, "\\_").replace(/~/g, "\\~");
}

const RESOLVE_USERS_CONCURRENCY = 8;

/** Resolve many user IDs to display names (deduped, bounded concurrency). */
export async function resolveSlackUserDisplayNames(token: string, userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean).map((u) => u.trim().toUpperCase()))];
  const map = new Map<string, string>();
  for (let i = 0; i < unique.length; i += RESOLVE_USERS_CONCURRENCY) {
    const chunk = unique.slice(i, i + RESOLVE_USERS_CONCURRENCY);
    await Promise.all(
      chunk.map(async (uid) => {
        const info = await slackUsersInfo(token, uid);
        map.set(uid, info?.name ?? uid);
      })
    );
  }
  return map;
}

export async function resolveSlackBotDisplayNames(token: string, botIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(botIds.filter(Boolean))];
  const map = new Map<string, string>();
  for (let i = 0; i < unique.length; i += RESOLVE_USERS_CONCURRENCY) {
    const chunk = unique.slice(i, i + RESOLVE_USERS_CONCURRENCY);
    await Promise.all(
      chunk.map(async (bid) => {
        const info = await slackBotsInfo(token, bid);
        map.set(bid, info?.name ?? "Bot");
      })
    );
  }
  return map;
}

export async function slackConversationsInfo(
  token: string,
  channel: string
): Promise<{ name: string | null }> {
  const data = await slackApi<{ channel?: { name?: string } }>("conversations.info", token, { channel });
  if (!data.ok || !data.channel?.name) return { name: null };
  return { name: data.channel.name };
}
