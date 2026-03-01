"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface LoginFormProps {
  title: string;
  subtitle: string;
  redirectTo: string;
}

export default function PartnerLoginForm({ title, subtitle, redirectTo }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "forgot" | "sent">("login");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    const res = await fetch("/api/auth/role");
    const { role } = await res.json();
    if (role === "partner") {
      try { await fetch("/api/partner/login-track", { method: "POST" }); } catch {}
      router.replace(redirectTo);
    } else if (role === "admin") {
      router.replace("/admin");
    } else {
      setError("This account doesn't have partner access. Please contact your account manager.");
      await supabase.auth.signOut();
    }
    setLoading(false);
    router.refresh();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });
    if (resetError) { setError(resetError.message); setResetLoading(false); return; }
    setMode("sent");
    setResetLoading(false);
  };

  return (
    <main className="ptr-login">
      <style>{`
        .ptr-login {
          min-height: 100vh; display: flex; font-family: 'DM Sans', sans-serif;
          background: #FDFCFA;
        }
        .ptr-left {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 40px 32px; position: relative; z-index: 1;
        }
        .ptr-right {
          display: none; flex: 1; position: relative; overflow: hidden;
          background: linear-gradient(135deg, #1A1714 0%, #2D261F 50%, #1A1714 100%);
        }
        @media (min-width: 768px) {
          .ptr-right { display: flex; align-items: center; justify-content: center; }
        }
        .ptr-right::before {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse 80% 60% at 50% 40%, rgba(201,169,98,0.12) 0%, transparent 70%);
        }
        .ptr-card {
          width: 100%; max-width: 400px;
        }
        .ptr-input {
          width: 100%; padding: 13px 16px; background: #FFF; border: 1.5px solid #E8E4DF;
          border-radius: 12px; color: #1A1714; font-size: 14px; font-family: 'DM Sans', sans-serif;
          outline: none; transition: all 0.2s;
        }
        .ptr-input:focus { border-color: #C9A962; box-shadow: 0 0 0 3px rgba(201,169,98,0.08); }
        .ptr-input::placeholder { color: #B5B0A8; }
        .ptr-btn {
          width: 100%; padding: 14px; background: #2D6A4F; color: #FFF;
          border: none; border-radius: 12px; font-size: 14px; font-weight: 600;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s;
        }
        .ptr-btn:hover:not(:disabled) { background: #245840; transform: translateY(-1px); box-shadow: 0 4px 16px rgba(45,106,79,0.25); }
        .ptr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ptr-link { background: none; border: none; color: #C9A962; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 0; transition: color 0.2s; }
        .ptr-link:hover { color: #B89A52; text-decoration: underline; }
        .ptr-back { background: none; border: none; color: #999; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 0; width: 100%; text-align: center; transition: color 0.2s; }
        .ptr-back:hover { color: #1A1714; }
        @keyframes ptrFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes ptrFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>

      {/* Left - Login Form */}
      <div className="ptr-left">
        <div className="ptr-card" style={{ animation: "ptrFade 0.5s ease" }}>
          {/* Brand */}
          <div style={{ marginBottom: 40 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{
                padding: "5px 14px", borderRadius: 8,
                background: "linear-gradient(135deg, rgba(201,169,98,0.12), rgba(201,169,98,0.04))",
                border: "1px solid rgba(201,169,98,0.2)",
              }}>
                <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 15, fontWeight: 600, letterSpacing: 2.5, color: "#C9A962" }}>OPS+</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#C9A962", letterSpacing: 0.5 }}>Partner Portal</span>
            </div>
          </div>

          {mode === "login" && (
            <>
              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 32, fontWeight: 500, color: "#1A1714", marginBottom: 6, lineHeight: 1.2 }}>
                  {title}
                </h1>
                <p style={{ fontSize: 14, color: "#888", lineHeight: 1.5 }}>{subtitle}</p>
              </div>

              {error && (
                <div style={{ background: "#FFF5F5", border: "1px solid #FED7D7", color: "#C53030", fontSize: 12, padding: "10px 14px", borderRadius: 10, marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Email address</label>
                  <input className="ptr-input" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input className="ptr-input" type={showPassword ? "text" : "password"} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} required
                      style={{ paddingRight: 40 }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle"
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, color: "#999" }}>
                      {showPassword ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      )}
                    </button>
                  </div>
                </div>
                <div style={{ textAlign: "right", marginBottom: 24 }}>
                  <button type="button" className="ptr-link" onClick={() => { setMode("forgot"); setError(""); }}>Forgot password?</button>
                </div>
                <button type="submit" className="ptr-btn" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in to your portal"}
                </button>
              </form>

              {/* Trust indicators */}
              <div style={{ marginTop: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span style={{ fontSize: 10, color: "#999" }}>Encrypted</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <span style={{ fontSize: 10, color: "#999" }}>Secure portal</span>
                </div>
              </div>
            </>
          )}

          {mode === "forgot" && (
            <>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, fontWeight: 500, color: "#1A1714", marginBottom: 6 }}>Reset your password</h1>
                <p style={{ fontSize: 14, color: "#888" }}>Enter your email and we&apos;ll send you a secure reset link</p>
              </div>
              {error && (
                <div style={{ background: "#FFF5F5", border: "1px solid #FED7D7", color: "#C53030", fontSize: 12, padding: "10px 14px", borderRadius: 10, marginBottom: 20 }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleForgotPassword}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 6 }}>Email address</label>
                  <input className="ptr-input" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <button type="submit" className="ptr-btn" disabled={resetLoading}>
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
              <div style={{ marginTop: 16 }}>
                <button className="ptr-back" onClick={() => { setMode("login"); setError(""); }}>← Back to sign in</button>
              </div>
            </>
          )}

          {mode === "sent" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 20 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16, margin: "0 auto 16px",
                  background: "#F0FFF4", border: "1px solid #C6F6D5",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="2" />
                    <path d="M22 7l-10 7L2 7" />
                  </svg>
                </div>
                <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 24, color: "#1A1714", marginBottom: 6 }}>Check your email</h2>
                <p style={{ fontSize: 13, color: "#888" }}>We sent a password reset link to <strong style={{ color: "#1A1714" }}>{email}</strong></p>
              </div>
              <div style={{ background: "#F0FFF4", border: "1px solid #C6F6D5", color: "#2D6A4F", fontSize: 12, padding: "10px 14px", borderRadius: 10, marginBottom: 20, textAlign: "center" }}>
                Check your inbox and spam folder
              </div>
              <button className="ptr-btn" onClick={() => { setMode("login"); setError(""); }}>
                Back to Sign In
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right - Decorative Panel (desktop only) */}
      <div className="ptr-right">
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "0 48px", maxWidth: 440 }}>
          {/* Floating cards */}
          <div style={{ marginBottom: 40, animation: "ptrFloat 4s ease-in-out infinite" }}>
            <div style={{
              display: "inline-flex", flexDirection: "column" as const, gap: 12,
              padding: "24px 28px", borderRadius: 16,
              background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
              backdropFilter: "blur(20px)", textAlign: "left" as const,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(201,169,98,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C9A962" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#E8E5E0" }}>Live GPS Tracking</div>
                  <div style={{ fontSize: 10, color: "#666" }}>Real-time delivery updates</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(45,106,79,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#E8E5E0" }}>Schedule & Calendar</div>
                  <div style={{ fontSize: 10, color: "#666" }}>Plan deliveries ahead</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#E8E5E0" }}>Share Tracking Links</div>
                  <div style={{ fontSize: 10, color: "#666" }}>Email or text your clients</div>
                </div>
              </div>
            </div>
          </div>

          <h2 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 28, color: "#E8E5E0", marginBottom: 8, lineHeight: 1.3 }}>
            Your delivery operations,<br />all in one place
          </h2>
          <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6 }}>
            Track deliveries, schedule pickups, share live updates with your clients, and manage invoices — powered by Yugo.
          </p>
        </div>
      </div>
    </main>
  );
}
