"use client";

import { useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const CHECK_INTERVAL_MS = 60_000; // check every 60s

export default function SessionTimeout() {
  const lastActivity = useRef(Date.now());
  const router = useRouter();

  const resetTimer = useCallback(() => {
    lastActivity.current = Date.now();
  }, []);

  useEffect(() => {
    const events = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;
    for (const ev of events) {
      document.addEventListener(ev, resetTimer, { passive: true });
    }
    return () => {
      for (const ev of events) {
        document.removeEventListener(ev, resetTimer);
      }
    };
  }, [resetTimer]);

  useEffect(() => {
    const interval = setInterval(async () => {
      if (Date.now() - lastActivity.current > IDLE_TIMEOUT_MS) {
        clearInterval(interval);
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login?reason=idle");
      }
    }, CHECK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [router]);

  return null;
}
