"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useNotifications } from "./NotificationContext";
import { usePendingChangeRequests } from "./PendingChangeRequestsContext";

async function createNotification(
  addNotification: (n: { id: string; title: string; icon?: string; link?: string; created_at?: string }) => void,
  payload: { title: string; body?: string; icon?: string; link?: string }
) {
  const res = await fetch("/api/admin/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    const data = await res.json();
    if (data.notification) addNotification(data.notification);
  }
}

export default function RealtimeListener() {
  const router = useRouter();
  const supabase = createClient();
  const { addNotification } = useNotifications();
  const { refetch: refetchPendingChangeRequests } = usePendingChangeRequests();

  useEffect(() => {
    const channel = supabase
      .channel("admin-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "moves" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as { move_code?: string; client_name?: string };
          createNotification(addNotification, {
            title: `New move created: ${row.move_code || "—"}`,
            icon: "party",
            link: "/admin/deliveries",
          });
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as { status?: string; move_code?: string };
          const prev = payload.old as { status?: string };
          if (row.status && prev?.status !== row.status) {
            const s = (row.status || "").toLowerCase();
            if (s === "completed" || s === "delivered" || s === "done") {
              createNotification(addNotification, {
                title: `Move ${row.move_code || "—"} completed`,
                icon: "truck",
                link: "/admin/deliveries",
              });
            }
          }
          const prevPaid = (payload.old as { payment_marked_paid?: boolean })?.payment_marked_paid;
          const currPaid = (payload.new as { payment_marked_paid?: boolean })?.payment_marked_paid;
          if (!prevPaid && currPaid) {
            createNotification(addNotification, {
              title: `Move ${(payload.new as { move_code?: string }).move_code || "—"} marked paid`,
              icon: "dollar",
              link: "/admin/invoices",
            });
          }
        }
        router.refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "deliveries" }, (payload) => {
        if (payload.eventType === "INSERT") {
          const row = payload.new as { delivery_number?: string };
          createNotification(addNotification, {
            title: `New delivery created: ${row.delivery_number || "—"}`,
            icon: "party",
            link: "/admin/deliveries",
          });
        } else if (payload.eventType === "UPDATE") {
          const row = payload.new as { stage?: string; delivery_number?: string };
          const prev = payload.old as { stage?: string };
          if (row.stage && prev?.stage !== row.stage && (row.stage || "").toLowerCase() === "completed") {
            createNotification(addNotification, {
              title: `Delivery ${row.delivery_number || "—"} completed`,
              icon: "truck",
              link: "/admin/deliveries",
            });
          }
        }
        router.refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "tracking_sessions" }, () => {
        router.refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "invoices" }, (payload) => {
        if (payload.eventType === "UPDATE") {
          const row = payload.new as { status?: string; invoice_number?: string };
          const prev = payload.old as { status?: string };
          if (row.status === "paid" && prev?.status !== "paid") {
            createNotification(addNotification, {
              title: `Invoice ${row.invoice_number || "—"} paid`,
              icon: "dollar",
              link: "/admin/invoices",
            });
          }
        }
        router.refresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "status_events" }, () => {
        router.refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "move_change_requests" }, () => {
        createNotification(addNotification, {
          title: "New client change request",
          icon: "clipboard",
          link: "/admin/change-requests",
        });
        refetchPendingChangeRequests();
        router.refresh();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crew_expenses" }, () => {
        createNotification(addNotification, {
          title: "New crew expense submitted",
          icon: "dollar",
          link: "/admin/crew",
        });
        router.refresh();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, supabase, addNotification, refetchPendingChangeRequests]);

  return null;
}
