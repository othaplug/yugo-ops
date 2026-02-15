"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"login" | "forgot" | "sent">("login");
  const [resetLoading, setResetLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

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
      background: "#0D0D0D", fontFamily: "'DM Sans', sans-serif", position: "relative", overflow: "hidden"
    }}>
      {/* Background orbs */}
      <div style={{ position: "absolute", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,169,98,0.06) 0%, transparent 70%)", top: -200, right: -200, pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,169,98,0.04) 0%, transparent 70%)", bottom: -100, left: -100, pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 420, padding: "0 24px", position: "relative", zIndex: 1, animation: "loginFadeIn 0.6s ease" }}>
        <style>{`
          @keyframes loginFadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
          .li:focus { border-color: #C9A962 !important; }
          .li::placeholder { color: #444; }
          .lb:hover:not(:disabled) { background: #D4B56C !important; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(201,169,98,0.25); }
          .lf:hover { color: #D4B56C !important; text-decoration: underline; }
          .lback:hover { color: #F5F5F3 !important; }
        `}</style>

        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 36, letterSpacing: 4, color: "#F5F5F3" }}>YUGO</div>
          <div style={{ display: "inline-flex", fontSize: 10, fontWeight: 600, letterSpacing: 2, color: "#C9A962", background: "rgba(201,169,98,0.12)", padding: "4px 12px", borderRadius: 20, marginTop: 8 }}>OPS+</div>
        </div>

        {/* Card */}
        <div style={{ background: "#1A1A1A", border: "1px solid #2A2A2A", borderRadius: 16, padding: "36px 32px" }}>
          {mode === "login" && (
            <>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, color: "#F5F5F3", marginBottom: 4 }}>Welcome back</div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 28 }}>Sign in to your operations dashboard</div>
              <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, transparent, #C9A962, transparent)", margin: "0 auto 32px" }} />
              {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#F87171", fontSize: 12, padding: "10px 14px", borderRadius: 8, marginBottom: 18 }}>{error}</div>}
              <form onSubmit={handleLogin}>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" as const, color: "#666", marginBottom: 6 }}>Email</label>
                  <input className="li" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                    style={{ width: "100%", padding: "12px 16px", background: "#0D0D0D", border: "1px solid #2A2A2A", borderRadius: 10, color: "#F5F5F3", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", transition: "border-color 0.2s" }} />
                </div>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" as const, color: "#666", marginBottom: 6 }}>Password</label>
                  <input className="li" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required
                    style={{ width: "100%", padding: "12px 16px", background: "#0D0D0D", border: "1px solid #2A2A2A", borderRadius: 10, color: "#F5F5F3", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", transition: "border-color 0.2s" }} />
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
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, color: "#F5F5F3", marginBottom: 4 }}>Reset password</div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 28 }}>Enter your email and we'll send a reset link</div>
              <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, transparent, #C9A962, transparent)", margin: "0 auto 32px" }} />
              {error && <div style={{ background: "rgba(248,113,113,0.1)", border: "1px solid rgba(248,113,113,0.2)", color: "#F87171", fontSize: 12, padding: "10px 14px", borderRadius: 8, marginBottom: 18 }}>{error}</div>}
              <form onSubmit={handleForgotPassword}>
                <div style={{ marginBottom: 18 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" as const, color: "#666", marginBottom: 6 }}>Email</label>
                  <input className="li" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                    style={{ width: "100%", padding: "12px 16px", background: "#0D0D0D", border: "1px solid #2A2A2A", borderRadius: 10, color: "#F5F5F3", fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none", transition: "border-color 0.2s" }} />
                </div>
                <button type="submit" className="lb" disabled={resetLoading}
                  style={{ width: "100%", padding: 13, background: "#C9A962", color: "#0D0D0D", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", cursor: resetLoading ? "not-allowed" : "pointer", transition: "all 0.2s", opacity: resetLoading ? 0.5 : 1 }}>
                  {resetLoading ? "Sending..." : "Send Reset Link"}
                </button>
              </form>
              <button className="lback" onClick={() => { setMode("login"); setError(""); }}
                style={{ display: "block", textAlign: "center" as const, fontSize: 12, color: "#666", cursor: "pointer", marginTop: 16, background: "none", border: "none", fontFamily: "'DM Sans', sans-serif", padding: 0, transition: "color 0.2s", width: "100%" }}>
                ← Back to sign in
              </button>
            </>
          )}

          {mode === "sent" && (
            <>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: 24, color: "#F5F5F3", marginBottom: 4 }}>Check your email</div>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 28 }}>We sent a password reset link to <strong style={{ color: "#F5F5F3" }}>{email}</strong></div>
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

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "#444" }}>
          Yugo Ops+ · Premium Logistics Platform
        </div>
      </div>
    </main>
  );
}