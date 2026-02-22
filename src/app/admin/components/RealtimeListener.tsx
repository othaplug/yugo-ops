"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "./NotificationContext";
import { usePendingChangeRequests } from "./PendingChangeRequestsContext";

export default function RealtimeListener() {
  const router = useRouter();
  const supabase = createClient();
  const { addNotification } = useNotifications();
  const { refetch: refetchPendingChangeRequests } = usePendingChangeRequests();

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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "move_change_requests" }, () => {
        addNotification({
          icon: "clipboard",
          title: "New client change request",
          time: "Just now",
          link: "/admin/change-requests",
        });
        refetchPendingChangeRequests();
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, supabase, addNotification, refetchPendingChangeRequests]);

  return null;
}