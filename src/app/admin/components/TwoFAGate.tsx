"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "./Toast";

const VERIFIED_KEY = "ops-2fa-verified";

export default function TwoFAGate({ children }: { children: React.ReactNode }) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { toast } = useToast();

  const sendCode = useCallback(async () => {
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/account/2fa/send", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send code");
      toast("Code sent to your email", "check");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send code");
      toast(err instanceof Error ? err.message : "Failed", "x");
    } finally {
      setSending(false);
    }
  }, [toast]);

  useEffect(() => {
    const check = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        setLoading(false);
        if (!user) return;

        const verified = sessionStorage.getItem(VERIFIED_KEY);
        if (verified === user.id) return;

        const { data: platformUser } = await supabase
          .from("platform_users")
          .select("two_factor_enabled")
          .eq("user_id", user.id)
          .single();

        if (platformUser?.two_factor_enabled) {
          setShowModal(true);
          sendCode();
        }
      } catch {
        setLoading(false);
      }
    };
    check();
  }, [sendCode]);

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
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) sessionStorage.setItem(VERIFIED_KEY, user.id);
      setShowModal(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid code");
      toast(err instanceof Error ? err.message : "Invalid code", "x");
    } finally {
      setVerifying(false);
    }
  };

  if (loading) return null;

  return (
    <>
      {children}
      {showModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-2xl p-6 animate-fade-up">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[rgba(201,169,98,0.12)] border border-[rgba(201,169,98,0.35)] mb-4">
                <span className="font-hero text-[18px] tracking-[2px] text-[var(--gold)]">OPS+</span>
              </div>
              <h2 className="font-heading text-[18px] font-bold text-[var(--tx)]">Two-factor verification</h2>
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
                  className="w-full px-4 py-3 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[20px] text-center font-mono tracking-[0.5em] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                  autoFocus
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={sending}
                  className="flex-1 py-2.5 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:opacity-50"
                >
                  {sending ? "Sending…" : "Resend code"}
                </button>
                <button
                  type="submit"
                  disabled={verifying || code.length !== 6}
                  className="flex-1 py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] disabled:opacity-50"
                >
                  {verifying ? "Verifying…" : "Verify"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
