"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import LoginForm from "./LoginForm";

export default function PartnerLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const res = await fetch("/api/auth/role");
        const { role } = await res.json();
        if (role === "partner") router.replace("/partner");
        else if (role === "admin") router.replace("/admin");
        else router.replace("/login");
      }
      setChecking(false);
    };
    check();
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--tx2)] text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <LoginForm
      title="Partner portal"
      subtitle="Sign in to your partner dashboard"
      redirectTo="/partner"
    />
  );
}
