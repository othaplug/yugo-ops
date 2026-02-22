"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RealtimeListener() {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const channel = supabase
      .channel("admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "moves" }, () => {
        router.refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, () => {
        router.refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tracking_sessions" }, () => {
        router.refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, () => {
        router.refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "status_events" }, () => {
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, supabase]);

  return null; // Invisible component, just listens
}