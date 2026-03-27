"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { resolveLoginPortal } from "@/lib/auth/resolve-login-portal";
import { useRouter, useSearchParams } from "next/navigation";
import LoginForm from "./LoginForm";

export default function PartnerLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [checking, setChecking] = useState(true);
  const errorParam = searchParams.get("error");
  const messageParam = searchParams.get("message");
  const isWelcome = searchParams.get("welcome") === "1";

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const portal = await resolveLoginPortal(supabase, user);
        if (portal === "partner") router.replace("/partner");
        else if (portal === "admin") router.replace("/admin");
        else if (!errorParam) {
          // No error in URL: send to /partner; that page will redirect back to /partner/login?error=no_org if no org
          router.replace("/partner");
        }
        // If errorParam is set (e.g. no_org), stay here so the user sees the error message instead of redirect loop
      }
      setChecking(false);
    };
    check();
  }, [router, errorParam]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
        <div className="text-[var(--tx2)] text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <LoginForm
      title={isWelcome ? "Welcome to Yugo" : "Partner portal"}
      subtitle={isWelcome ? "Use the credentials from your invite email to sign in" : "Sign in to your partner dashboard"}
      redirectTo="/partner"
      isWelcome={isWelcome}
      initialError={errorParam === "partner_lookup" && messageParam ? decodeURIComponent(messageParam) : errorParam === "no_org" ? "No organization linked to this account. Contact support." : undefined}
    />
  );
}
