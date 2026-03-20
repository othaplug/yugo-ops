"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import YugoLogo from "@/components/YugoLogo";
import { Eye, EyeSlash, EnvelopeSimple as Envelope } from "@phosphor-icons/react";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "forgot" | "sent">("login");
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const isFirstTime = useMemo(() => searchParams.get("welcome") === "1", [searchParams]);

  useEffect(() => {
    document.documentElement.style.setProperty("--login-bg", "#08080A");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFirstTime && !consentChecked) {
      setError("Please agree to the Privacy Policy and Terms of Use to continue.");
      return;
    }
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
        .adm-input {
          width: 100%; padding: 12px 14px; background: #08080A; border: 1px solid #1E1E22;
          border-radius: 10px; color: #E8E5E0; font-size: 14px; font-family: 'DM Sans', sans-serif;
          outline: none; transition: border-color 0.2s, box-shadow 0.2s;
        }
        .adm-input:focus { border-color: rgba(201,169,98,0.55); box-shadow: 0 0 0 3px rgba(201,169,98,0.1); }
        .adm-input::placeholder { color: #3A3A3E; }
        .adm-btn {
          width: 100%; padding: 13px; background: linear-gradient(135deg, #C9A962 0%, #B89A52 100%);
          color: #08080A; border: none; border-radius: 10px; font-size: 14px; font-weight: 700;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: all 0.2s;
          text-transform: uppercase; letter-spacing: 1px; min-height: 48px;
        }
        .adm-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(201,169,98,0.35); }
        .adm-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .adm-link { background: none; border: none; color: #C9A962; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 0; transition: color 0.2s; }
        .adm-link:hover { color: #D4B56C; text-decoration: underline; }
        .adm-back { background: none; border: none; color: #4A4A4E; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 0; transition: color 0.2s; width: 100%; text-align: center; min-height: 40px; display: flex; align-items: center; justify-content: center; }
        .adm-back:hover { color: #E8E5E0; }
        @keyframes admFade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="adm-grid" />

      <div style={{ width: "100%", maxWidth: 420, padding: "0 24px", position: "relative", zIndex: 1, animation: "admFade 0.5s ease" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
            <YugoLogo size={22} variant="gold" />
            <div style={{ height: 16, width: 1, background: "#1E1E22" }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: "#4A4A4E" }}>Admin Console</span>
          </div>

          {mode === "login" && (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: "#E8E5E0", marginBottom: 4, fontFamily: "'Instrument Sans', 'DM Sans', sans-serif" }}>
                  {isFirstTime ? "Welcome to YUGO" : "Welcome back"}
                </div>
                <div style={{ fontSize: 13, color: "#4A4A4E" }}>
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
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, color: "#4A4A4E", marginBottom: 7 }}>Email</label>
                  <input className="adm-input" type="email" placeholder="admin@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, color: "#4A4A4E", marginBottom: 7 }}>Password</label>
                  <div style={{ position: "relative" }}>
                    <input className="adm-input" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required
                      style={{ paddingRight: 36 }} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Toggle"
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, color: "#4A4A4E" }}>
                      {showPassword ? (
                        <Eye size={14} className="text-[#4A4A4E]" />
                      ) : (
                        <EyeSlash size={14} className="text-[#4A4A4E]" />
                      )}
                    </button>
                  </div>
                </div>
                <div style={{ textAlign: "right", marginBottom: 20 }}>
                  <button type="button" className="adm-link" onClick={() => { setMode("forgot"); setError(""); }}>Forgot password?</button>
                </div>

                {isFirstTime && (
                  <div style={{ marginBottom: 18, padding: "11px 13px", background: "rgba(201,169,98,0.04)", borderRadius: 8, border: "1px solid rgba(201,169,98,0.1)" }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={consentChecked}
                        onChange={(e) => setConsentChecked(e.target.checked)}
                        style={{ marginTop: 2, width: 13, height: 13, accentColor: "#C9A962", flexShrink: 0, cursor: "pointer" }}
                      />
                      <span style={{ fontSize: 10, color: "#4A4A4E", lineHeight: 1.7 }}>
                        I agree to Yugo&apos;s{" "}
                        <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#C9A962", textDecoration: "underline" }}>Privacy Policy</a> and{" "}
                        <a href="/legal/terms-of-use" target="_blank" rel="noopener noreferrer" style={{ color: "#C9A962", textDecoration: "underline" }}>Terms of Use</a>
                      </span>
                    </label>
                  </div>
                )}

                <button type="submit" className="adm-btn" disabled={loading || (isFirstTime && !consentChecked)} style={{ opacity: isFirstTime && !consentChecked ? 0.5 : undefined }}>
                  {loading ? "Authenticating..." : "Sign In"}
                </button>
              </form>
            </>
          )}

          {mode === "forgot" && (
            <>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 22, fontWeight: 600, color: "#E8E5E0", marginBottom: 4 }}>Reset password</div>
                <div style={{ fontSize: 13, color: "#4A4A4E" }}>We&apos;ll send a secure reset link to your email</div>
              </div>
              {error && (
                <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", color: "#F87171", fontSize: 11, padding: "8px 12px", borderRadius: 6, marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleForgotPassword}>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, color: "#4A4A4E", marginBottom: 7 }}>Email</label>
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
                  <Envelope size={24} color="#4ADE80" />
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
    </main>
  );
}
