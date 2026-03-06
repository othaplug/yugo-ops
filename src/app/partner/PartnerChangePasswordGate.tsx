"use client";

import { useState, useEffect } from "react";
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
        <div className="w-7 h-7 border-2 border-[#C9A962] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      {children}
      {showModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-2xl overflow-hidden" style={{ animation: "ptrFadeUp 0.4s ease" }}>
            <style>{`@keyframes ptrFadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`}</style>

            <div className="px-6 pt-6 pb-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#F0FFF4] border border-[#C6F6D5] flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
              <h2 className="text-[22px] font-bold text-[#1A1A1A]" style={{ fontFamily: "'Instrument Serif', Georgia, serif" }}>
                Set your password
              </h2>
              <p className="text-[13px] text-[#888] mt-1.5 leading-relaxed">
                For security, please replace your temporary password with a new one.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
              {error && (
                <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-[11px] font-semibold text-[#888] mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 8 characters"
                    required
                    minLength={8}
                    className="w-full px-4 py-3 bg-white border border-[#E8E4DF] rounded-xl text-[14px] text-[#1A1A1A] placeholder:text-[#B5B0A8] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none pr-10"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#999] p-1" tabIndex={-1}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {showPw
                        ? <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>
                        : <><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></>
                      }
                    </svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[#888] mb-1.5">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="w-full px-4 py-3 bg-white border border-[#E8E4DF] rounded-xl text-[14px] text-[#1A1A1A] placeholder:text-[#B5B0A8] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 rounded-xl text-[14px] font-bold bg-[#2D6A4F] text-white hover:bg-[#245840] transition-all disabled:opacity-50"
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
