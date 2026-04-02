"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  MagnifyingGlass,
  EnvelopeSimpleOpen,
  EnvelopeSimple,
} from "@phosphor-icons/react";

interface Message {
  id: string;
  thread_id: string;
  move_id: string;
  sender_name: string;
  sender_type: string;
  content: string;
  is_read: boolean;
  created_at: string;
  move_code: string | null;
  client_name: string | null;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

type FilterType = "all" | "unread" | "client" | "admin";

export default function InboxClient({ messages }: { messages: Message[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const filtered = useMemo(() => {
    let result = messages;

    if (filter === "unread") result = result.filter((m) => !m.is_read);
    else if (filter === "client") result = result.filter((m) => m.sender_type === "client");
    else if (filter === "admin") result = result.filter((m) => m.sender_type === "admin");

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.content.toLowerCase().includes(q) ||
          m.sender_name.toLowerCase().includes(q) ||
          (m.client_name ?? "").toLowerCase().includes(q) ||
          (m.move_code ?? "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [messages, search, filter]);

  const unreadCount = messages.filter((m) => !m.is_read).length;

  const FILTERS: { value: FilterType; label: string }[] = [
    { value: "all", label: "All" },
    { value: "unread", label: `Unread (${unreadCount})` },
    { value: "client", label: "Clients" },
    { value: "admin", label: "Admin" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-[var(--tx1)]">Inbox</h1>
          {unreadCount > 0 && (
            <span className="rounded-full bg-[var(--red)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--red)]">
              {unreadCount} unread
            </span>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx2)]"
            aria-hidden
          />
          <input
            type="text"
            placeholder="Search messages, clients, move codes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-[var(--brd)] bg-[var(--bg2)] py-2 pl-11 pr-4 text-sm text-[var(--tx1)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] focus:outline-none focus:ring-1 focus:ring-[var(--gold)]"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.value
                  ? "bg-[var(--gold)]/15 text-[var(--gold)]"
                  : "text-[var(--tx3)] hover:bg-[var(--bg2)]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Message List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--brd)] py-16 text-center px-4">
          <p className="text-sm text-[var(--tx3)]">
            {search || filter !== "all" ? "No messages match your filters." : "No messages yet."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-[var(--brd)] rounded-xl border border-[var(--brd)] bg-[var(--bg1)]">
          {filtered.map((m) => (
            <Link
              key={m.id}
              href={`/admin/moves/${m.move_id}`}
              className={`flex items-start gap-4 px-5 py-4 transition-colors hover:bg-[var(--bg2)] ${
                !m.is_read ? "bg-[var(--gold)]/[0.03]" : ""
              }`}
            >
              {/* Read indicator */}
              <div className="mt-1 flex-shrink-0">
                {m.is_read ? (
                  <EnvelopeSimpleOpen size={18} className="text-[var(--tx3)]" />
                ) : (
                  <EnvelopeSimple size={18} weight="fill" className="text-[var(--gold)]" />
                )}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className={`text-sm font-medium ${
                      m.is_read ? "text-[var(--tx2)]" : "text-[var(--tx1)]"
                    }`}
                  >
                    {m.client_name || m.sender_name}
                  </span>
                  {m.move_code && (
                    <span className="rounded bg-[var(--bg2)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--tx3)]">
                      {m.move_code}
                    </span>
                  )}
                  <span
                    className={`ml-auto inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      m.sender_type === "client"
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "bg-[var(--gold)]/10 text-[var(--gold)]"
                    }`}
                  >
                    {m.sender_type === "client" ? "Client" : "Admin"}
                  </span>
                </div>
                <p
                  className={`truncate text-sm ${
                    m.is_read ? "text-[var(--tx3)]" : "text-[var(--tx2)]"
                  }`}
                >
                  {m.content}
                </p>
              </div>

              {/* Timestamp */}
              <span className="flex-shrink-0 text-xs text-[var(--tx3)] whitespace-nowrap mt-0.5">
                {timeAgo(m.created_at)}
              </span>
            </Link>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-[var(--tx3)]">
        Showing {filtered.length} of {messages.length} messages
      </p>
    </div>
  );
}
