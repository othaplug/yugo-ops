"use client";

import { useState, useEffect } from "react";
import { Lock, Eye, EyeSlash } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function PartnerChangePasswordGate({ children }: { children: React.ReactNode }) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [showPw, setShowPw] = useState(false);
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
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }
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
        <div className="w-7 h-7 border-2 border-[#2C3E2D] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {children}
      {showModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 modal-overlay">
          <div className="w-full max-w-[420px] bg-[#FFFBF7] rounded-lg border border-[#2C3E2D]/10 shadow-[0_24px_80px_rgba(44,62,45,0.14)] overflow-hidden" style={{ animation: "ptrFadeUp 0.4s ease" }}>
            <style>{`@keyframes ptrFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 rounded-sm border border-[#2C3E2D]/15 flex items-center justify-center mx-auto mb-4 bg-[#2C3E2D]/[0.04]">
                <Lock size={28} color="#2C3E2D" />
              </div>
              <h2 className="font-hero text-[22px] font-normal text-[#5C1A33]">
                Set your password
              </h2>
              <p className="text-[13px] text-[var(--tx3)] mt-1.5 leading-relaxed">
                For security, please replace your temporary password with a new one.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
              {error && (
                <div className="px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[12px] text-red-600">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                    className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--brd)] rounded-xl text-[var(--text-base)] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[#2C3E2D] focus:ring-1 focus:ring-[#2C3E2D]/30 outline-none pr-10"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--tx3)] p-1" tabIndex={-1}>
                    {showPw ? <Eye size={16} weight="regular" /> : <EyeSlash size={16} weight="regular" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1.5">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full px-4 py-3 bg-[var(--card)] border border-[var(--brd)] rounded-xl text-[var(--text-base)] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[#2C3E2D] focus:ring-1 focus:ring-[#2C3E2D]/30 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-sm text-[10px] font-bold tracking-[0.12em] uppercase bg-[#2C3E2D] text-white hover:bg-[#243828] transition-colors disabled:opacity-50"
              >
                {saving ? "Updating..." : "Set new password"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
