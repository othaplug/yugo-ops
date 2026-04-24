"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock } from "@phosphor-icons/react";

const SESSION_KEY = "yugo_developer_acknowledged";
const MATCH_PHRASE = "I understand";

/**
 * PR 2 friction gate. Mounts before any developer-level content. On first
 * visit in a session, requires the user to type "I understand". Once
 * confirmed, writes a session flag; on reload the gate re-mounts and the
 * flag is rechecked so the confirmation does not carry across sessions.
 */
export default function DeveloperInterstitial() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [ackStatus, setAckStatus] = useState<"checking" | "locked" | "passed">(
    "checking",
  );

  useEffect(() => {
    try {
      const ack = sessionStorage.getItem(SESSION_KEY);
      setAckStatus(ack === "1" ? "passed" : "locked");
    } catch {
      setAckStatus("locked");
    }
  }, []);

  const handleConfirm = () => {
    if (value.trim() !== MATCH_PHRASE) return;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
    } catch {}
    router.replace("/admin/platform?tab=devices");
  };

  if (ackStatus === "checking") {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <p className="t-body text-[var(--color-text-secondary)]">Loading…</p>
      </div>
    );
  }

  if (ackStatus === "passed") {
    router.replace("/admin/platform?tab=devices");
    return null;
  }

  const canConfirm = value.trim() === MATCH_PHRASE;

  return (
    <div className="mx-auto max-w-[560px] py-[var(--space-12)]">
      <div className="flex flex-col items-start gap-[var(--space-4)]">
        <span className="inline-flex items-center gap-2 rounded-[var(--radius-full)] bg-[var(--color-wine-subtle)] px-[var(--space-3)] py-[var(--space-1)] t-label text-[var(--color-text-secondary)]">
          <Lock size={12} weight="bold" aria-hidden />
          Developer settings
        </span>

        <h1 className="t-display text-[var(--color-text-primary)]">
          Developer settings
        </h1>

        <p className="t-body text-[var(--color-text-secondary)]">
          This area controls how Yugo+ syncs with external systems (HubSpot,
          Square, Twilio). Changes here can break live operations for all
          users. All changes are logged.
        </p>

        <label className="block w-full">
          <span className="t-label text-[var(--color-text-secondary)] mb-[var(--space-2)] block">
            Type &ldquo;I understand&rdquo; to continue
          </span>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="I understand"
            className="w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-3)] t-body text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-wine)]"
          />
        </label>

        <div className="flex items-center gap-[var(--space-3)] pt-[var(--space-2)]">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-wine)] px-[var(--space-5)] py-[var(--space-3)] text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-wine-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Continue
          </button>
          <Link
            href="/admin/settings/personal"
            className="inline-flex items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-5)] py-[var(--space-3)] text-[13px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-subtle)]"
          >
            Go back
          </Link>
        </div>
      </div>
    </div>
  );
}
