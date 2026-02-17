"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function ChangePasswordGate({ children }: { children: React.ReactNode }) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setLoading(false);
      if (user?.user_metadata?.must_change_password === true) {
        setShowModal(true);
      }
    };
    check();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
        data: { must_change_password: false },
      });
      if (updateError) throw updateError;
      setShowModal(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setSaving(false);
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
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-2xl p-6 animate-fade-up">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-[rgba(201,169,98,0.12)] border border-[rgba(201,169,98,0.35)] mb-4">
                <span className="font-hero text-[20px] tracking-[3px] text-[var(--gold)]">OPS+</span>
              </div>
              <h2 className="font-heading text-[20px] font-bold text-[var(--tx)]">Welcome to OPS+</h2>
              <p className="text-[12px] text-[var(--tx3)] mt-1">For security, please set a new password for your account.</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="px-3 py-2 rounded-lg bg-[var(--rdim)] border border-[var(--red)]/30 text-[12px] text-[var(--red)]">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-lg text-[13px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
              >
                {saving ? "Updating…" : "Update password"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
