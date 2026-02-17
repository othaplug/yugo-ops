"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface LoginFormProps {
  title: string;
  subtitle: string;
  redirectTo: string;
}

export default function LoginForm({ title, subtitle, redirectTo }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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
    if (role === "partner") router.replace(redirectTo);
    else if (role === "admin") router.replace("/admin");
    else {
      setError("You don't have access to the partner portal. Sign in at the main login.");
      await supabase.auth.signOut();
    }
    setLoading(false);
    router.refresh();
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg)] p-4">
      <div className="w-full max-w-[400px]">
        <div className="text-center mb-6">
          <div className="inline-flex px-5 py-2.5 rounded-full bg-[var(--gdim)] border border-[var(--gold)]/40 mb-4">
            <span className="font-hero text-[18px] tracking-[3px] text-[var(--gold)]">OPS+</span>
          </div>
          <h1 className="font-heading text-[22px] font-bold text-[var(--tx)]">{title}</h1>
          <p className="text-[13px] text-[var(--tx3)] mt-1">{subtitle}</p>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-6">
          {error && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-[var(--rdim)] border border-[var(--red)]/30 text-[12px] text-[var(--red)]">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg text-[13px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
        <p className="text-center mt-4">
          <a href="/login" className="text-[12px] text-[var(--tx3)] hover:text-[var(--gold)]">
            ← Back to main login
          </a>
        </p>
      </div>
    </main>
  );
}
