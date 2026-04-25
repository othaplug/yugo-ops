"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Yu3PortaledTokenRoot } from "@/hooks/useAdminShellTheme";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;  // 30 minutes → sign out
const WARN_BEFORE_MS  =  5 * 60 * 1000;  // warn 5 minutes before
const CHECK_INTERVAL_MS = 15_000;         // check every 15s for better accuracy

export default function SessionTimeout() {
  const lastActivity = useRef(Date.now());
  const [warningVisible, setWarningVisible] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const resetTimer = useCallback(() => {
    lastActivity.current = Date.now();
    if (warningVisible) {
      setWarningVisible(false);
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    }
  }, [warningVisible]);

  // Track user activity
  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
    for (const ev of events) {
      document.addEventListener(ev, resetTimer, { passive: true });
    }
    return () => {
      for (const ev of events) {
        document.removeEventListener(ev, resetTimer);
      }
    };
  }, [resetTimer]);

  // Main idle check loop
  useEffect(() => {
    const interval = setInterval(() => {
      const idle = Date.now() - lastActivity.current;
      const warnAt = IDLE_TIMEOUT_MS - WARN_BEFORE_MS;

      if (idle >= IDLE_TIMEOUT_MS) {
        // Time's up — sign out
        clearInterval(interval);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setWarningVisible(false);
        const supabase = createClient();
        supabase.auth.signOut().then(() => {
          router.push("/login?reason=idle");
        });
        return;
      }

      if (idle >= warnAt && !warningVisible) {
        // Enter warning window — show modal and start countdown
        setWarningVisible(true);
        const remaining = Math.ceil((IDLE_TIMEOUT_MS - idle) / 1000);
        setSecondsLeft(remaining);

        countdownRef.current = setInterval(() => {
          setSecondsLeft((s) => {
            if (s <= 1) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              return 0;
            }
            return s - 1;
          });
        }, 1000);
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  if (!warningVisible) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeStr = mins > 0
    ? `${mins}:${String(secs).padStart(2, "0")}`
    : `${secondsLeft}s`;

  return (
    <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-4 pointer-events-none">
      <Yu3PortaledTokenRoot
        className="pointer-events-auto w-full max-w-sm rounded-[var(--yu3-r-xl)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] p-5 text-[var(--yu3-ink)] shadow-[var(--yu3-shadow-lg)] animate-fade-up"
        role="alertdialog"
        aria-live="assertive"
      >
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[var(--yu3-ink-strong)] leading-tight">Session expiring soon</p>
            <p className="text-[11px] text-[var(--yu3-ink-faint)] mt-0.5">
              You&apos;ve been inactive. You&apos;ll be signed out in{" "}
              <span className="font-bold text-amber-400 tabular-nums">{timeStr}</span>.
            </p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-[var(--yu3-line)] rounded-full overflow-hidden mb-4">
          <div
            className="h-full bg-amber-400 rounded-full transition-all duration-1000"
            style={{ width: `${(secondsLeft / (WARN_BEFORE_MS / 1000)) * 100}%` }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={resetTimer}
            className="admin-btn admin-btn-primary flex-1"
          >
            Stay signed in
          </button>
          <button
            onClick={async () => {
              setWarningVisible(false);
              const supabase = createClient();
              await supabase.auth.signOut();
              router.push("/login");
            }}
            className="px-4 py-2 rounded-xl text-[12px] font-semibold border border-[var(--yu3-line)] text-[var(--yu3-ink-faint)] hover:text-[var(--yu3-ink)] transition-colors"
          >
            Sign out
          </button>
        </div>
      </Yu3PortaledTokenRoot>
    </div>
  );
}
