"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../components/Toast";

export default function Enable2FAButton({ enabled }: { enabled?: boolean }) {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [localEnabled, setLocalEnabled] = useState<boolean>(!!enabled);
  const [showWarning, setShowWarning] = useState(false);

  const doToggle = async (turningOn: boolean) => {
    setLoading(true);
    setLocalEnabled(turningOn);
    try {
      const endpoint = turningOn ? "/api/account/2fa/enable" : "/api/account/2fa/disable";
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast(
        turningOn
          ? "2FA enabled. A verification code will be emailed on each login."
          : "2FA disabled.",
        "check"
      );
      router.refresh();
    } catch (err: unknown) {
      setLocalEnabled(!turningOn);
      toast(err instanceof Error ? err.message : "Failed", "x");
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = () => {
    if (loading) return;
    if (localEnabled) {
      setShowWarning(true);
    } else {
      doToggle(true);
    }
  };

  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={localEnabled}
        aria-label={localEnabled ? "2FA is on — click to disable" : "2FA is off — click to enable"}
        onClick={handleToggle}
        disabled={loading}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 disabled:cursor-not-allowed ${
          localEnabled ? "bg-[var(--grn)]" : "bg-[var(--brd)]"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
            localEnabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>

      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowWarning(false)} />
          <div className="relative bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 max-w-sm w-full shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-[var(--red)]/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[var(--red)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-[13px] text-[var(--tx)] mb-1">Disable two-factor authentication?</div>
                <p className="text-[11px] text-[var(--tx3)] leading-relaxed">
                  This will remove the extra layer of security from your account. Anyone with your password will be able to sign in without a verification code.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowWarning(false)}
                className="flex-1 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
              >
                Keep enabled
              </button>
              <button
                onClick={() => { setShowWarning(false); doToggle(false); }}
                className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-[var(--red)]/10 text-[var(--red)] border border-[var(--red)]/30 hover:bg-[var(--red)]/20 transition-colors"
              >
                Disable 2FA
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
