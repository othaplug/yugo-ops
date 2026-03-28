"use client";

import { useState, useEffect } from "react";
import { X, Eye, EyeSlash, Lock, Shield, MapPin, Calendar, ShareNetwork, Envelope } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { resolveLoginPortal } from "@/lib/auth/resolve-login-portal";
import { useRouter } from "next/navigation";
import YugoLogo from "@/components/YugoLogo";

interface LoginFormProps {
  title: string;
  subtitle: string;
  redirectTo: string;
  initialError?: string;
  isWelcome?: boolean;
}

export default function PartnerLoginForm({ title, subtitle, redirectTo, initialError, isWelcome }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [mode, setMode] = useState<"login" | "forgot" | "sent">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [consentChecked, setConsentChecked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isWelcome && !consentChecked) {
      setError("Please agree to the Privacy Policy and Terms of Use to continue.");
      return;
    }
    setLoading(true);
    setError("");
    const { data: signData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    if (!signData.user) {
      setError("Sign-in did not return a user. Please try again.");
      setLoading(false);
      return;
    }
    const portal = await resolveLoginPortal(supabase, signData.user);
    const token = signData.session?.access_token;
    if (token) {
      try {
        await fetch("/api/auth/audit-login", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* best-effort */
      }
    }
    if (portal === "partner") {
      try {
        await fetch("/api/partner/login-track", { method: "POST" });
      } catch {
        /* best-effort */
      }
      router.replace(redirectTo);
    } else if (portal === "admin") {
      router.replace("/admin");
    } else {
      setError(
        "Your account doesn't have partner portal access.\n\nWe don't see a partner organization tied to this login. Contact your YUGO+ contact or support to get access."
      );
      await supabase.auth.signOut();
    }
    setLoading(false);
    router.refresh();
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetLoading(true);
    setError("");
    try {
      const res = await fetch("/api/partner/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong");
        setResetLoading(false);
        return;
      }
      setMode("sent");
    } catch {
      setError("Something went wrong. Please try again.");
    }
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
        .ptr-back { background: none; border: none; color: #6B6B6B; font-size: 12px; cursor: pointer; font-family: 'DM Sans', sans-serif; padding: 0; width: 100%; text-align: center; transition: color 0.2s; }
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
              <YugoLogo size={20} variant="gold" />
              <div style={{ height: 16, width: 1, background: "rgba(201,169,98,0.3)" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#C9A962", letterSpacing: 0.5 }}>Partner Portal</span>
            </div>
          </div>

          {mode === "login" && (
            <>
              {isWelcome && (
                <div style={{ background: "#F0FFF4", border: "1px solid #C6F6D5", color: "#2D6A4F", fontSize: 13, padding: "12px 16px", borderRadius: 12, marginBottom: 20, lineHeight: 1.5 }}>
                  <strong>Welcome!</strong> Your partner account is ready. Sign in with the email and temporary password from your invite.
                </div>
              )}

              <div style={{ marginBottom: 32 }}>
                <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 32, fontWeight: 500, color: "#1A1714", marginBottom: 6, lineHeight: 1.2 }}>
                  {title}
                </h1>
                <p style={{ fontSize: 14, color: "#4F4B47", lineHeight: 1.5 }}>{subtitle}</p>
              </div>

              {error && (
                <div style={{ background: "#FFF5F5", border: "1px solid #FED7D7", color: "#C53030", fontSize: 12, padding: "10px 14px", borderRadius: 10, marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <X size={14} weight="regular" style={{ flexShrink: 0, marginTop: 2 }} />
                  <span style={{ whiteSpace: "pre-line", lineHeight: 1.5 }}>{error}</span>
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
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, color: "#6B6B6B" }}>
                      {showPassword ? (
                        <Eye size={16} weight="regular" />
                      ) : (
                        <EyeSlash size={16} weight="regular" />
                      )}
                    </button>
                  </div>
                </div>
                <div style={{ textAlign: "right", marginBottom: 24 }}>
                  <button type="button" className="ptr-link" onClick={() => { setMode("forgot"); setError(""); }}>Forgot password?</button>
                </div>

                {isWelcome && (
                  <div style={{ marginBottom: 20, padding: "12px 14px", background: "#F7F5F0", borderRadius: 10, border: "1px solid #E8E4DC" }}>
                    <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={consentChecked}
                        onChange={(e) => setConsentChecked(e.target.checked)}
                        style={{ marginTop: 3, width: 15, height: 15, accentColor: "#2D6A4F", flexShrink: 0, cursor: "pointer" }}
                      />
                      <span style={{ fontSize: 12, color: "#777", lineHeight: 1.6 }}>
                        I agree to Yugo&apos;s{" "}
                        <a href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#C9A962", textDecoration: "underline" }}>Privacy Policy</a> and{" "}
                        <a href="/legal/terms-of-use" target="_blank" rel="noopener noreferrer" style={{ color: "#C9A962", textDecoration: "underline" }}>Terms of Use</a>
                      </span>
                    </label>
                  </div>
                )}

                <button type="submit" className="ptr-btn" disabled={loading || (isWelcome && !consentChecked)} style={{ opacity: isWelcome && !consentChecked ? 0.5 : undefined }}>
                  {loading ? "Signing in..." : "Sign in to your portal"}
                </button>
              </form>

              {/* Trust indicators */}
              <div style={{ marginTop: 28, display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Lock size={12} color="#2D6A4F" />
                  <span style={{ fontSize: 10, color: "#6B6B6B" }}>Encrypted</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Shield size={12} color="#2D6A4F" />
                  <span style={{ fontSize: 10, color: "#6B6B6B" }}>Secure portal</span>
                </div>
              </div>
            </>
          )}

          {mode === "forgot" && (
            <>
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, fontWeight: 500, color: "#1A1714", marginBottom: 6 }}>Reset your password</h1>
                <p style={{ fontSize: 14, color: "#4F4B47" }}>Enter your email and we&apos;ll send you a temporary password and login link</p>
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
                  {resetLoading ? "Sending..." : "Email reset"}
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
                  <Envelope size={28} color="#2D6A4F" />
                </div>
                <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, color: "#1A1714", marginBottom: 6 }}>Check your email</h2>
                <p style={{ fontSize: 13, color: "#4F4B47" }}>If that email is on file, we sent a temporary password and login link to <strong style={{ color: "#1A1714" }}>{email}</strong></p>
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
                  <MapPin size={18} color="#C9A962" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#E8E5E0" }}>Live GPS Tracking</div>
                  <div style={{ fontSize: 10, color: "#666" }}>Real-time delivery updates</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(45,106,79,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Calendar size={18} color="#4ADE80" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#E8E5E0" }}>Schedule & Calendar</div>
                  <div style={{ fontSize: 10, color: "#666" }}>Plan deliveries ahead</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ShareNetwork size={18} color="#A78BFA" />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#E8E5E0" }}>Share Tracking Links</div>
                  <div style={{ fontSize: 10, color: "#666" }}>Email or text your clients</div>
                </div>
              </div>
            </div>
          </div>

          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, color: "#E8E5E0", marginBottom: 8, lineHeight: 1.3 }}>
            Your delivery operations,<br />all in one place
          </h2>
          <p style={{ fontSize: 13, color: "#666", lineHeight: 1.6, display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: 6 }}>
            Track deliveries, schedule pickups, share live updates with your clients, and manage invoices, powered by{" "}
            <YugoLogo size={16} variant="gold" />
          </p>
        </div>
      </div>
    </main>
  );
}
