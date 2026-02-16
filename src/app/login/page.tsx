"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
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
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const isFirstTime = useMemo(() => searchParams.get("welcome") === "1", [searchParams]);

  useEffect(() => {
    const saved = localStorage.getItem("yugo-theme") as "light" | "dark";
    if (saved) setTheme(saved);
  }, []);

  const isLight = theme === "light";
  const bg = isLight ? "#F5F5F2" : "#0D0D0D";
  const cardBg = isLight ? "#FFF" : "#1A1A1A";
  const cardBorder = isLight ? "#E0DDD8" : "#2A2A2A";
  const text = isLight ? "#1A1A1A" : "#F5F5F3";
  const muted = isLight ? "#555" : "#666";
  const inputBg = isLight ? "#FFF" : "#0D0D0D";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); setLoading(false); return; }
    router.push("/admin");
    router.refresh();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/admin/settings`,
    });
    if (resetError) { setError(resetError.message); setResetLoading(false); return; }
    setMode("sent");
    setResetLoading(false);
  };

  return (
    <main style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: bg, fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden"
    }}>
      <div style={{ width: "100%", maxWidth: 460, padding: "0 28px", position: "relative", zIndex: 1, animation: "loginFadeIn 0.6s ease" }}>
        <style>{`
          @keyframes loginFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
          .li:focus { border-color: #C9A962 !important; }
          .li::placeholder { color: #444; }
          .lb:hover:not(:disabled) { background: #D4B56C !important; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(201,169,98,0.25); }
          .lf:hover { color: #D4B56C !important; text-decoration: underline; }
          .lback:hover { color: #1A1A1A !important; }
        `}</style>

        {/* Card - refined, sleeker */}
        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 20, padding: "36px 40px", boxShadow: isLight ? "0 4px 24px rgba(0,0,0,0.04)" : "0 4px 24px rgba(0,0,0,0.2)" }}>
          {/* OPS+ Logo - inside card, smaller */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h1
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "8px 20px",
                borderRadius: 9999,
                background: isLight ? "rgba(201,169,98,0.1)" : "rgba(201,169,98,0.08)",
                border: `1px solid ${isLight ? "rgba(201,169,98,0.45)" : "rgba(201,169,98,0.4)"}`,
                color: "#C9A962",
                fontFamily: "'Instrument Serif', Georgia, serif",
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: 3,
                margin: 0,
              }}
            >
              OPS+
            </h1>
          </div>
          {mode === "login" && (
            <>
              <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 26, color: text, marginBottom: 6 }}>{isFirstTime ? "Welcome to OPS+" : "Welcome back"}</div>
              <div style={{ fontSize: 14, color: muted, marginBottom: 32 }}>{isFirstTime ? "Sign in with your credentials to get started" : "Sign in to your operations dashboard"}</div>
              <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, transparent, #C9A962, transparent)", margin: "0 auto 32px" }} />
              {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#F87171", fontSize: 12, padding: "10px 14px", borderRadius: 8, marginBottom: 18 }}>{error}</div>}
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" as const, color: muted, marginBottom: 6 }}>Email</label>
                  <input className="li" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                    style={{ width: "100%", padding: "12px 16px", background: inputBg, border: `1px solid ${cardBorder}`, borderRadius: 10, color: text, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", transition: "border-color 0.2s" }} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" as const, color: muted, marginBottom: 6 }}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input className="li" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required
                      style={{ width: "100%", padding: "12px 36px 12px 16px", background: inputBg, border: `1px solid ${cardBorder}`, borderRadius: 10, color: text, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", transition: "border-color 0.2s" }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, color: "#666", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {showPassword ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      )}
                    </button>
                  </div>
                </div>
                <button type="button" className="lf" onClick={() => { setMode("forgot"); setError(""); }}
                  style={{ display: "block", textAlign: "right" as const, fontSize: 12, color: "#C9A962", cursor: "pointer", marginTop: -10, marginBottom: 20, background: "none", border: "none", fontFamily: "'DM Sans', sans-serif", padding: 0, transition: "color 0.2s", width: "100%" }}>
                  Forgot password?
                </button>
                <button type="submit" className="lb" disabled={loading}
                  style={{ width: "100%", padding: 13, background: "#C9A962", color: "#0D0D0D", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s", opacity: loading ? 0.5 : 1 }}>
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>
            </>
          )}

          {mode === "forgot" && (
            <>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 26, color: text, marginBottom: 6 }}>Reset password</div>
              <div style={{ fontSize: 14, color: muted, marginBottom: 32 }}>Enter your email and we&apos;ll send a reset link</div>
              <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, transparent, #C9A962, transparent)", margin: "0 auto 32px" }} />
              {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#F87171", fontSize: 12, padding: "10px 14px", borderRadius: 8, marginBottom: 18 }}>{error}</div>}
              <form onSubmit={handleForgotPassword}>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" as const, color: muted, marginBottom: 6 }}>Email</label>
                  <input className="li" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                    style={{ width: "100%", padding: "12px 16px", background: inputBg, border: `1px solid ${cardBorder}`, borderRadius: 10, color: text, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", transition: "border-color 0.2s" }} />
                </div>
                <button type="submit" className="lb" disabled={resetLoading}
                  style={{ width: "100%", padding: 13, background: "#C9A962", color: "#0D0D0D", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: resetLoading ? "not-allowed" : "pointer", transition: "all 0.2s", opacity: resetLoading ? 0.5 : 1 }}>
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
              <button className="lback" onClick={() => { setMode("login"); setError(""); }}
                style={{ display: "block", textAlign: "center" as const, fontSize: 12, color: muted, cursor: "pointer", marginTop: 16, background: "none", border: "none", fontFamily: "'DM Sans', sans-serif", padding: 0, transition: "color 0.2s", width: "100%" }}>
                ← Back to sign in
              </button>
            </>
          )}

          {mode === "sent" && (
            <>
              <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 24, color: text, marginBottom: 4 }}>Check your email</div>
              <div style={{ fontSize: 13, color: muted, marginBottom: 28 }}>We sent a password reset link to <strong style={{ color: text }}>{email}</strong></div>
              <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, transparent, #C9A962, transparent)", margin: "0 auto 32px" }} />
              <div style={{ background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.2)", color: "#4ADE80", fontSize: 12, padding: "10px 14px", borderRadius: 8, marginBottom: 18, textAlign: "center" as const }}>
                Reset link sent successfully. Check your inbox and spam folder.
              </div>
              <button className="lb" onClick={() => { setMode("login"); setError(""); }}
                style={{ width: "100%", padding: 13, background: "#C9A962", color: "#0D0D0D", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: "pointer", transition: "all 0.2s" }}>
                Back to Sign In
              </button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}