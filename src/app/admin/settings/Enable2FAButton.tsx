"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../components/Toast";
import { Warning } from "@phosphor-icons/react";

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
        aria-label={localEnabled ? "2FA is on, click to disable" : "2FA is off, click to enable"}
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
        <div className="fixed inset-0 z-[99999] flex min-h-0 items-center justify-center p-4 sm:p-5 bg-black/60">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowWarning(false)} />
          <div className="relative bg-[var(--card)] border border-[var(--brd)] rounded-t-2xl sm:rounded-xl p-5 sm:max-w-sm w-full shadow-xl animate-slide-up sm:animate-none" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-lg bg-[var(--red)]/10 flex items-center justify-center flex-shrink-0">
                <Warning size={20} color="var(--red)" aria-hidden />
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
                className="flex-1 py-1.5 rounded text-[11px] font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-all"
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
