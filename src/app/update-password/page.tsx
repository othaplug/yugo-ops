"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      setUserEmail(user.email || "");
      setChecking(false);
    };
    checkSession();
  }, [router, supabase]);

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

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(async () => {
      const res = await fetch("/api/auth/role");
      const { role } = await res.json();
      if (role === "partner") router.push("/partner");
      else if (role === "admin") router.push("/admin");
      else router.push("/login");
    }, 2000);
  };

  const [theme, setTheme] = useState<"light" | "dark">("dark");
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

  if (checking) {
    return (
      <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: bg }}>
        <div style={{ color: muted, fontSize: 14 }}>Loading...</div>
      </main>
    );
  }

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
        `}</style>

        <div style={{ background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 20, padding: "36px 40px", boxShadow: isLight ? "0 4px 24px rgba(0,0,0,0.04)" : "0 4px 24px rgba(0,0,0,0.2)" }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <h1 style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              padding: "8px 20px", borderRadius: 9999,
              background: isLight ? "rgba(201,169,98,0.1)" : "rgba(201,169,98,0.08)",
              border: `1px solid ${isLight ? "rgba(201,169,98,0.45)" : "rgba(201,169,98,0.4)"}`,
              color: "#C9A962", fontFamily: "'Instrument Serif', Georgia, serif",
              fontSize: 18, fontWeight: 600, letterSpacing: 3, margin: 0,
            }}>
              OPS+
            </h1>
          </div>

          {success ? (
            <>
              <div style={{ textAlign: "center", marginBottom: 8 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", margin: "0 auto 16px",
                  background: "rgba(74,222,128,0.1)", border: "1px solid rgba(74,222,128,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ADE80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </div>
              <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 24, color: text, textAlign: "center", marginBottom: 6 }}>
                Password updated
              </div>
              <div style={{ fontSize: 13, color: muted, textAlign: "center", marginBottom: 16 }}>
                Your password has been changed successfully. Redirecting...
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 26, color: text, marginBottom: 6 }}>
                Update your password
              </div>
              <div style={{ fontSize: 14, color: muted, marginBottom: 8 }}>
                Choose a new secure password for your account
              </div>
              {userEmail && (
                <div style={{ fontSize: 12, color: muted, marginBottom: 24 }}>
                  Signed in as <strong style={{ color: text }}>{userEmail}</strong>
                </div>
              )}
              <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, transparent, #C9A962, transparent)", margin: "0 auto 28px" }} />

              {error && (
                <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#F87171", fontSize: 12, padding: "10px 14px", borderRadius: 8, marginBottom: 18 }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" as const, color: muted, marginBottom: 6 }}>
                    New Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      className="li"
                      type={showPassword ? "text" : "password"}
                      placeholder="Min 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoFocus
                      style={{ width: "100%", padding: "12px 36px 12px 16px", background: inputBg, border: `1px solid ${cardBorder}`, borderRadius: 10, color: text, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", transition: "border-color 0.2s" }}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide" : "Show"}
                      style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 2, color: "#666", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {showPassword ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                      )}
                    </button>
                  </div>
                </div>
                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" as const, color: muted, marginBottom: 6 }}>
                    Confirm Password
                  </label>
                  <input
                    className="li"
                    type={showPassword ? "text" : "password"}
                    placeholder="Re-enter password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
                    style={{ width: "100%", padding: "12px 16px", background: inputBg, border: `1px solid ${cardBorder}`, borderRadius: 10, color: text, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", transition: "border-color 0.2s" }}
                  />
                </div>

                {/* Strength indicator */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                    {[1, 2, 3, 4].map((i) => {
                      const strength = password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password) && /[!@#$%^&*]/.test(password) ? 4
                        : password.length >= 10 && /[A-Z]/.test(password) && /[0-9]/.test(password) ? 3
                        : password.length >= 8 ? 2 : password.length > 0 ? 1 : 0;
                      const active = i <= strength;
                      const color = strength <= 1 ? "#F87171" : strength === 2 ? "#FBBF24" : strength === 3 ? "#C9A962" : "#4ADE80";
                      return (
                        <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: active ? color : (isLight ? "#E0DDD8" : "#2A2A2A"), transition: "background 0.2s" }} />
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10, color: muted }}>
                    Use 8+ characters with uppercase, numbers, and symbols for a strong password
                  </div>
                </div>

                <button type="submit" className="lb" disabled={loading}
                  style={{ width: "100%", padding: 13, background: "#C9A962", color: "#0D0D0D", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: loading ? "not-allowed" : "pointer", transition: "all 0.2s", opacity: loading ? 0.5 : 1 }}>
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
