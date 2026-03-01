"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "forgot" | "sent">("login");
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const isFirstTime = useMemo(() => searchParams.get("welcome") === "1", [searchParams]);

  useEffect(() => {
    document.documentElement.style.setProperty("--login-bg", "#08080A");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setLoading(false); return; }
    const res = await fetch("/api/auth/role");
    const { role } = await res.json();
    if (role === "client") router.push("/client");
    else if (role === "partner") router.push("/partner");
    else router.push("/admin");
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
    <main className="adm-login">
      <style>{`
        .adm-login {
          min-height: 100vh; display: flex; align-items: center; justify-content: center;
          background: #08080A; font-family: 'DM Sans', sans-serif;
          position: relative; overflow: hidden;
        }
        .adm-login::before {
          content: ''; position: absolute; inset: 0; z-index: 0;
          background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(201,169,98,0.06) 0%, transparent 70%);
        }
        .adm-grid {
          position: absolute; inset: 0; z-index: 0; opacity: 0.03;
          background-image: linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .adm-card {
          background: #111113; border: 1px solid #1E1E22; border-radius: 16px;
          padding: 40px; box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          position: relative; overflow: hidden;
        }
        .adm-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(201,169,98,0.3), transparent);
        }
        .adm-input {
          width: 100%; padding: 11px 14px; background: #08080A; border: 1px solid #1E1E22;
          border-radius: 8px; color: #E8E5E0; font-size: 13px; font-family: 'DM Sans', sans-serif;
          outline: none; transition: border-color 0.2s;
        }
        .adm-input:focus { border-color: #C9A962; }
        .adm-input::placeholder { color: #3A3A3E; }
        .adm-btn {
          width: 100%; padding: 12px; background: linear-gradient(135deg, #C9A962 0%, #B89A52 100%);
          color: #08080A; border: none; border-radius: 8px; font-size: 13px; font-weight: 700;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s;
          text-transform: uppercase; letter-spacing: 1px;
        }
        .adm-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(201,169,98,0.3); }
        .adm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .adm-link { background: none; border: none; color: #C9A962; font-size: 11px; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 0; transition: color 0.2s; }
        .adm-link:hover { color: #D4B56C; text-decoration: underline; }
        .adm-back { background: none; border: none; color: #4A4A4E; font-size: 11px; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 0; transition: color 0.2s; width: 100%; text-align: center; }
        .adm-back:hover { color: #E8E5E0; }
        @keyframes admFade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="adm-grid" />

      <div style={{ width: "100%", maxWidth: 420, padding: "0 24px", position: "relative", zIndex: 1, animation: "admFade 0.5s ease" }}>
        <div className="adm-card">
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
            <div style={{
              padding: "6px 16px", borderRadius: 6,
              background: "rgba(201,169,98,0.08)", border: "1px solid rgba(201,169,98,0.2)",
            }}>
              <span style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 16, fontWeight: 600, letterSpacing: 3, color: "#C9A962" }}>OPS+</span>
            </div>
            <div style={{ height: 20, width: 1, background: "#1E1E22" }} />
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: "#4A4A4E" }}>Admin Console</span>
          </div>

          {mode === "login" && (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: "#E8E5E0", marginBottom: 4, fontFamily: "'DM Sans', sans-serif" }}>
                  {isFirstTime ? "Welcome to OPS+" : "Welcome back"}
                </div>
                <div style={{ fontSize: 12, color: "#4A4A4E" }}>
                  {isFirstTime ? "Sign in with your credentials" : "Sign in to your operations dashboard"}
                </div>
              </div>
              {error && (
                <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", color: "#F87171", fontSize: 11, padding: "8px 12px", borderRadius: 6, marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, color: "#4A4A4E", marginBottom: 6 }}>Email</label>
                  <input className="adm-input" type="email" placeholder="admin@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, color: "#4A4A4E", marginBottom: 6 }}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input className="adm-input" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required
                      style={{ paddingRight: 36 }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle"
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, color: "#4A4A4E" }}>
                      {showPassword ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      )}
                    </button>
                  </div>
                </div>
                <div style={{ textAlign: "right", marginBottom: 20 }}>
                  <button type="button" className="adm-link" onClick={() => { setMode("forgot"); setError(""); }}>Forgot password?</button>
                </div>
                <button type="submit" className="adm-btn" disabled={loading}>
                  {loading ? "Authenticating..." : "Sign In"}
                </button>
              </form>
            </>
          )}

          {mode === "forgot" && (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 20, fontWeight: 600, color: "#E8E5E0", marginBottom: 4 }}>Reset password</div>
                <div style={{ fontSize: 12, color: "#4A4A4E" }}>We&apos;ll send a secure reset link to your email</div>
              </div>
              {error && (
                <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", color: "#F87171", fontSize: 11, padding: "8px 12px", borderRadius: 6, marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleForgotPassword}>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, color: "#4A4A4E", marginBottom: 6 }}>Email</label>
                  <input className="adm-input" type="email" placeholder="admin@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <button type="submit" className="adm-btn" disabled={resetLoading}>
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
              <div style={{ marginTop: 14 }}>
                <button className="adm-back" onClick={() => { setMode("login"); setError(""); }}>← Back to sign in</button>
              </div>
            </>
          )}

          {mode === "sent" && (
            <>
              <div style={{ textAlign: "center", marginBottom: 16 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 8, margin: "0 auto 14px",
                  background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.15)",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#E8E5E0", marginBottom: 4 }}>Check your inbox</div>
                <div style={{ fontSize: 12, color: "#4A4A4E" }}>Reset link sent to <strong style={{ color: "#E8E5E0" }}>{email}</strong></div>
              </div>
              <div style={{ background: "rgba(74,222,128,0.06)", border: "1px solid rgba(74,222,128,0.12)", color: "#4ADE80", fontSize: 11, padding: "8px 12px", borderRadius: 6, marginBottom: 16, textAlign: "center" }}>
                Check your inbox and spam folder
              </div>
              <button className="adm-btn" onClick={() => { setMode("login"); setError(""); }}>
                Back to Sign In
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <span style={{ fontSize: 10, color: "#2A2A2E", letterSpacing: 1 }}>YUGO OPERATIONS PLATFORM</span>
        </div>
      </div>
    </main>
  );
}
