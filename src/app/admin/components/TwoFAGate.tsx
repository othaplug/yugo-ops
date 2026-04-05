"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";
import GlobalModal from "@/components/ui/Modal";
import YugoLogo from "@/components/YugoLogo";

export default function TwoFAGate({ children }: { children: React.ReactNode }) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  // Prevent auto-send from firing more than once per mount
  const hasAutoSent = useRef(false);
  const router = useRouter();
  const toastRef = useRef(useToast().toast);

  // Keep toastRef in sync without it being a dependency
  const { toast } = useToast();
  useEffect(() => { toastRef.current = toast; }, [toast]);

  const sendCode = async (isAuto = false) => {
    if (isAuto && hasAutoSent.current) return;
    if (isAuto) hasAutoSent.current = true;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/account/2fa/send", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      if (!isAuto) toastRef.current("Code sent to your email", "check");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send code";
      setError(msg);
      toastRef.current(msg, "x");
      // Release the auto-send lock on failure so user can retry manually
      if (isAuto) hasAutoSent.current = false;
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    // Check trust cookie server-side — a single GET, no email sent
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch("/api/account/2fa/status");
        if (cancelled) return;
        if (!res.ok) { setLoading(false); return; }
        const { needsVerify } = await res.json() as { trusted: boolean; needsVerify: boolean };
        setLoading(false);
        if (needsVerify) {
          setShowModal(true);
          // Auto-send exactly once per mount
          sendCode(true);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    check();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setVerifying(true);
    setError("");
    try {
      const res = await fetch("/api/account/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code");
      // Trust is now stored in httpOnly cookie — no sessionStorage needed
      setShowModal(false);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid code";
      setError(msg);
      toastRef.current(msg, "x");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] text-[var(--tx3)]">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      {showModal && (
        <GlobalModal open={showModal} onClose={() => {}} title="" noHeader>
          <div className="p-6">
            <div className="text-center mb-6">
              <YugoLogo size={22} variant="auto" className="mb-4 inline-block" />
              <h2 className="admin-section-h2">Two-factor verification</h2>
              <p className="text-[12px] text-[var(--tx3)] mt-1">Enter the 6-digit code sent to your email</p>
            </div>
            <form onSubmit={handleVerify} className="space-y-4">
              {error && (
                <div className="px-3 py-2 rounded-lg bg-[var(--rdim)] border border-[var(--red)]/30 text-[12px] text-[var(--red)]">
                  {error}
                </div>
              )}
              <div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[20px] text-center font-mono tracking-[0.5em] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => sendCode(false)}
                  disabled={sending}
                  className="flex-1 py-2.5 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Resend code"}
                </button>
                <button
                  type="submit"
                  disabled={verifying || code.length !== 6}
                  className="flex-1 py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] disabled:opacity-50"
                >
                  {verifying ? "Verifying…" : "Verify"}
                </button>
              </div>
            </form>
          </div>
        </GlobalModal>
      )}
    </>
  );
}
