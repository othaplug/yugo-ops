"use client";

import { useState, useLayoutEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveLoginPortal } from "@/lib/auth/resolve-login-portal";
import { useRouter, useSearchParams } from "next/navigation";
import YugoLogo from "@/components/YugoLogo";
import { CaretRight, Eye, EyeSlash, EnvelopeSimple as Envelope } from "@phosphor-icons/react";
import { applyDocumentLightTheme } from "@/lib/document-theme-tokens";
import { promiseWithTimeout } from "@/lib/promise-with-timeout";

const SIGN_IN_TIMEOUT_MS = 45_000
const PORTAL_RESOLVE_TIMEOUT_MS = 25_000

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

  /* Login is its own wine shell; reset html from any prior admin dark session so chrome matches this screen */
  useLayoutEffect(() => {
    applyDocumentLightTheme();
    document.documentElement.style.setProperty("--login-bg", "#5C1A33");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isFirstTime && !consentChecked) {
      setError("Please agree to the Privacy Policy and Terms of Use to continue.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { data: signData, error: authError } = await promiseWithTimeout(
        supabase.auth.signInWithPassword({
          email,
          password,
        }),
        SIGN_IN_TIMEOUT_MS,
        "Sign-in timed out. Check your connection and try again."
      )
      if (authError) {
        setError(authError.message);
        return;
      }
      const user = signData.user;
      if (!user) {
        setError("Sign-in did not return a user. Please try again.");
        return;
      }

      const portal = await promiseWithTimeout(
        resolveLoginPortal(supabase, user),
        PORTAL_RESOLVE_TIMEOUT_MS,
        "Could not finish sign-in. Check your connection and try again."
      )
      const token = signData.session?.access_token;
      /* Do not await: a slow /api/auth/audit-login must not block navigation or leave the button stuck. */
      if (token) {
        void fetch("/api/auth/audit-login", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {
          /* best-effort audit */
        })
      }
      if (portal === "client") router.replace("/client");
      else if (portal === "partner") router.replace("/partner");
      else router.replace("/admin");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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
          min-height: 100dvh; min-height: 100vh; display: flex; align-items: center; justify-content: center;
          padding: max(1.25rem, env(safe-area-inset-top, 0px)) max(1.25rem, env(safe-area-inset-right, 0px)) max(1.25rem, env(safe-area-inset-bottom, 0px)) max(1.25rem, env(safe-area-inset-left, 0px));
          box-sizing: border-box;
          background: linear-gradient(165deg, #5C1A33 0%, #3e1021 42%, #2a0c18 100%);
          font-family: 'DM Sans', sans-serif;
          position: relative; overflow: hidden;
        }
        .adm-login::before {
          content: ''; position: absolute; inset: 0; z-index: 0;
          background: radial-gradient(ellipse 75% 60% at 50% 8%, rgba(255,255,255,0.085) 0%, transparent 58%),
                      radial-gradient(ellipse 55% 45% at 100% 100%, rgba(236, 214, 220, 0.07) 0%, transparent 62%);
        }
        .adm-grid {
          position: absolute; inset: 0; z-index: 0; opacity: 0.04;
          background-image: linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px);
          background-size: 48px 48px;
        }
        .adm-input {
          width: 100%; padding: 12px 0; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.22);
          border-radius: 0; color: rgba(255,255,255,0.94); font-size: 14px; font-family: 'DM Sans', sans-serif;
          outline: none; transition: border-color 0.2s;
        }
        .adm-input:focus { border-bottom-color: rgba(255,255,255,0.72); box-shadow: none; }
        .adm-input::placeholder { color: rgba(255,255,255,0.28); }
        .adm-btn {
          width: 100%; padding: 13px 16px;
          background: transparent;
          color: rgba(255,255,255,0.95);
          border: 1px solid rgba(255,255,255,0.88);
          border-radius: 10px; font-size: 11px; font-weight: 700;
          font-family: 'DM Sans', sans-serif; cursor: pointer; transition: background 0.2s, border-color 0.2s, transform 0.2s;
          text-transform: uppercase; letter-spacing: 0.12em; min-height: 48px;
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          -webkit-tap-highlight-color: transparent;
        }
        .adm-btn:hover:not(:disabled) {
          background: rgba(255,255,255,0.08);
          border-color: rgba(255,255,255,0.95);
        }
        .adm-btn:active:not(:disabled) { transform: scale(0.99); }
        .adm-btn:disabled { opacity: 0.45; cursor: not-allowed; }
        .adm-link { background: none; border: none; color: rgba(255,255,255,0.52); font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 0; transition: color 0.2s; }
        .adm-link:hover { color: rgba(255,255,255,0.92); text-decoration: underline; }
        .adm-back { background: none; border: none; color: rgba(255,255,255,0.45); font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 0; transition: color 0.2s; width: 100%; text-align: center; min-height: 40px; display: flex; align-items: center; justify-content: center; }
        .adm-back:hover { color: rgba(255,255,255,0.9); }
        @keyframes admFade { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="adm-grid" />

      <div style={{ width: "100%", maxWidth: 420, padding: "0 24px", position: "relative", zIndex: 1, animation: "admFade 0.5s ease" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
            <YugoLogo size={22} variant="cream" />
            <div style={{ height: 16, width: 1, background: "rgba(255,255,255,0.18)" }} />
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase" as const,
                color: "rgba(255,255,255,0.42)",
              }}
            >
              Admin Console
            </span>
          </div>

          {mode === "login" && (
            <>
              <div style={{ marginBottom: 24 }}>
                <div
                  className="font-hero"
                  style={{
                    fontSize: 34,
                    fontWeight: 600,
                    color: "#FFFBF7",
                    marginBottom: 6,
                    letterSpacing: "-0.02em",
                    lineHeight: 1.15,
                  }}
                >
                  {isFirstTime ? "Welcome to Yugo" : "Welcome back"}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.48)", lineHeight: 1.45 }}>
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
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase" as const,
                      color: "rgba(255,255,255,0.42)",
                      marginBottom: 7,
                    }}
                  >
                    Email
                  </label>
                  <input className="adm-input" type="email" placeholder="admin@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase" as const,
                      color: "rgba(255,255,255,0.42)",
                      marginBottom: 7,
                    }}
                  >
                    Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input className="adm-input" type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required
                      style={{ paddingRight: 32 }} />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      style={{
                        position: "absolute",
                        right: 4,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 8,
                        minWidth: 40,
                        minHeight: 40,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "rgba(255,255,255,0.45)",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      {showPassword ? (
                        <EyeSlash size={16} weight="regular" style={{ color: "rgba(255,255,255,0.55)" }} aria-hidden />
                      ) : (
                        <Eye size={16} weight="regular" style={{ color: "rgba(255,255,255,0.55)" }} aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
                <div style={{ textAlign: "right", marginBottom: 20 }}>
                  <button type="button" className="adm-link" onClick={() => { setMode("forgot"); setError(""); }}>Forgot password?</button>
                </div>

                {isFirstTime && (
                  <div
                    style={{
                      marginBottom: 18,
                      padding: "11px 13px",
                      background: "rgba(255,255,255,0.04)",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.12)",
                    }}
                  >
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 9, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={consentChecked}
                        onChange={(e) => setConsentChecked(e.target.checked)}
                        style={{ marginTop: 2, width: 13, height: 13, accentColor: "#2C3E2D", flexShrink: 0, cursor: "pointer" }}
                      />
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.52)", lineHeight: 1.7 }}>
                        I agree to Yugo&apos;s{" "}
                        <a
                          href="/legal/privacy-policy"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "rgba(255,255,255,0.88)", textDecoration: "underline" }}
                        >
                          Privacy Policy
                        </a>{" "}
                        and{" "}
                        <a
                          href="/legal/terms-of-use"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: "rgba(255,255,255,0.88)", textDecoration: "underline" }}
                        >
                          Terms of Use
                        </a>
                      </span>
                    </label>
                  </div>
                )}

                <button type="submit" className="adm-btn" disabled={loading || (isFirstTime && !consentChecked)} style={{ opacity: isFirstTime && !consentChecked ? 0.5 : undefined }}>
                  {loading ? (
                    "Authenticating…"
                  ) : (
                    <>
                      Sign in
                      <CaretRight size={18} weight="bold" aria-hidden style={{ flexShrink: 0 }} />
                    </>
                  )}
                </button>
              </form>
            </>
          )}

          {mode === "forgot" && (
            <>
              <div style={{ marginBottom: 24 }}>
                <div
                  className="font-hero"
                  style={{ fontSize: 26, fontWeight: 600, color: "#FFFBF7", marginBottom: 6, letterSpacing: "-0.02em", lineHeight: 1.15 }}
                >
                  Reset password
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.48)", lineHeight: 1.45 }}>We&apos;ll send a secure reset link to your email</div>
              </div>
              {error && (
                <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", color: "#F87171", fontSize: 11, padding: "8px 12px", borderRadius: 6, marginBottom: 16 }}>
                  {error}
                </div>
              )}
              <form onSubmit={handleForgotPassword}>
                <div style={{ marginBottom: 18 }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase" as const,
                      color: "rgba(255,255,255,0.42)",
                      marginBottom: 7,
                    }}
                  >
                    Email
                  </label>
                  <input className="adm-input" type="email" placeholder="admin@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
                </div>
                <button type="submit" className="adm-btn" disabled={resetLoading}>
                  {resetLoading ? (
                    "Sending…"
                  ) : (
                    <>
                      Send reset link
                      <CaretRight size={18} weight="bold" aria-hidden style={{ flexShrink: 0 }} />
                    </>
                  )}
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
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 8,
                    margin: "0 auto 14px",
                    background: "rgba(44, 62, 45, 0.35)",
                    border: "1px solid rgba(255,255,255,0.14)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Envelope size={24} weight="regular" style={{ color: "rgba(255,255,255,0.75)" }} />
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "#FFFBF7", marginBottom: 4 }}>Check your inbox</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.48)" }}>
                  Reset link sent to <strong style={{ color: "rgba(255,255,255,0.92)" }}>{email}</strong>
                </div>
              </div>
              <div
                style={{
                  background: "rgba(44, 62, 45, 0.25)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.78)",
                  fontSize: 11,
                  padding: "8px 12px",
                  borderRadius: 6,
                  marginBottom: 16,
                  textAlign: "center",
                }}
              >
                Check your inbox and spam folder
              </div>
              <button type="button" className="adm-btn" onClick={() => { setMode("login"); setError(""); }}>
                Back to sign in
                <CaretRight size={18} weight="bold" aria-hidden style={{ flexShrink: 0 }} />
              </button>
            </>
          )}

      </div>
    </main>
  );
}
