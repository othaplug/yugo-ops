"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "../components/Toast";

type SlackRow = { ts: string; author: string; text: string; isBot: boolean };

type GetPayload =
  | {
      configured: false;
      error: string;
    }
  | {
      configured: true;
      channelName: string | null;
      channelId: string;
      messages: SlackRow[];
      error?: string;
    };

function formatSlackTs(ts: string): string {
  const n = parseFloat(ts);
  if (Number.isNaN(n)) return "";
  const d = new Date(n * 1000);
  return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function MessagesPageClient() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<GetPayload | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/slack/messages", { credentials: "same-origin" });
      if (!res.ok) {
        setData({
          configured: false,
          error:
            res.status === 401
              ? "You need to be signed in."
              : `Could not load messages (${res.status}).`,
        });
        return;
      }
      const json = (await res.json()) as GetPayload;
      setData(json);
    } catch {
      setData({ configured: false, error: "Failed to load messages." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const channelId = data?.configured ? data.channelId : null;

  useEffect(() => {
    if (!channelId) return;
    const supabase = createClient();
    const room = supabase
      .channel(`slack-realtime:${channelId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "slack_message_events",
          filter: `channel_id=eq.${channelId}`,
        },
        (payload) => {
          const row = payload.new as {
            ts: string;
            author: string;
            body: string;
            is_bot: boolean;
          };
          setData((prev) => {
            if (!prev || !prev.configured) return prev;
            if (prev.messages.some((m) => m.ts === row.ts)) return prev;
            const messages = [...prev.messages, { ts: row.ts, author: row.author, text: row.body, isBot: row.is_bot }].sort(
              (a, b) => parseFloat(a.ts) - parseFloat(b.ts)
            );
            return { ...prev, messages };
          });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(room);
    };
  }, [channelId]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/admin/slack/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ text }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Send failed");
      setDraft("");
      toast("Sent to Slack", "check");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not send", "x");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-[13px] text-[var(--tx3)]">Loading…</div>
    );
  }

  if (!data) return null;

  if (!data.configured) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        <h1 className="font-heading text-xl font-bold text-[var(--tx)]">Slack messages</h1>
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 text-[13px] text-[var(--tx2)] leading-relaxed">
          <p className="font-semibold text-[var(--tx)] mb-2">Slack is not configured</p>
          <p>{data.error}</p>
          <ul className="mt-4 list-disc pl-5 space-y-1 text-[12px] text-[var(--tx3)]">
            <li>
              Create a Slack app, install it to your workspace, and add bot scopes such as{" "}
              <code className="text-[11px]">chat:write</code>, <code className="text-[11px]">channels:history</code>,{" "}
              <code className="text-[11px]">channels:read</code>, <code className="text-[11px]">users:read</code>, and{" "}
              <code className="text-[11px]">bots:read</code> (for bot display names).
            </li>
            <li>
              Set <code className="text-[11px]">SLACK_BOT_TOKEN</code> (Bot User OAuth token) and{" "}
              <code className="text-[11px]">SLACK_ADMIN_CHANNEL</code> or <code className="text-[11px]">SLACK_CHANNEL_ID</code>{" "}
              to the channel ID (e.g. C…).
            </li>
            <li>Invite the bot to that channel in Slack, then redeploy.</li>
          </ul>
        </div>
      </div>
    );
  }

  const rows = data.messages ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col min-h-[calc(100dvh-8rem)]">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="font-heading text-xl font-bold text-[var(--tx)]">Slack</h1>
          <p className="text-[12px] text-[var(--tx3)] mt-0.5">
            {data.channelName || "Channel"} · one workspace channel · new messages appear live when Event Subscriptions + SLACK_SIGNING_SECRET are set
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
        >
          Refresh
        </button>
      </div>

      {data.error && (
        <div className="mb-3 text-[12px] text-[var(--org)] rounded-lg border border-[var(--org)]/30 bg-[var(--org)]/5 px-3 py-2">
          {data.error}
        </div>
      )}

      <div className="flex-1 min-h-[240px] rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {rows.length === 0 ? (
            <p className="text-[13px] text-[var(--tx3)]">No messages yet, or history is empty.</p>
          ) : (
            rows.map((m) => (
              <div key={m.ts} className="text-[13px] leading-snug">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="font-semibold text-[var(--tx)]">{m.author}</span>
                  {m.isBot && (
                    <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--tx3)]">Bot</span>
                  )}
                  <span className="text-[10px] text-[var(--tx3)] tabular-nums">{formatSlackTs(m.ts)}</span>
                </div>
                <div className="mt-1.5 whitespace-pre-wrap font-sans text-[var(--tx2)] text-[12px] leading-relaxed break-words">
                  {m.text}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t border-[var(--brd)] p-3 bg-[var(--bg)]">
          <label className="sr-only" htmlFor="slack-msg">
            Message
          </label>
          <textarea
            id="slack-msg"
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a message to your team channel…"
            className="w-full rounded-lg border border-[var(--brd)] bg-[var(--card)] text-[var(--tx)] text-[13px] px-3 py-2 placeholder:text-[var(--tx3)] focus:outline-none focus:ring-2 focus:ring-[var(--gold)]/40 resize-y min-h-[72px]"
            maxLength={4000}
            disabled={sending}
          />
          <div className="flex justify-end mt-2">
            <button
              type="button"
              onClick={() => send()}
              disabled={sending || !draft.trim()}
              className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors"
            >
              {sending ? "Sending…" : "Send to Slack"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
