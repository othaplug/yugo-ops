"use client"

import { useEffect, useRef } from "react"
import { useNotifications } from "./NotificationContext"
import { useToast } from "./Toast"

/**
 * After the initial list is loaded, toasts a short banner for every new unread in-app
 * notification (realtime insert, polling, or addNotification) so operators get a cue
 * even when the bell count updates.
 */
export function AdminNotificationToastBridge() {
  const { notifications, listLoaded } = useNotifications()
  const { toast } = useToast()
  const seeded = useRef(false)
  const seenIds = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!listLoaded) return
    if (!seeded.current) {
      seenIds.current = new Set(notifications.map((n) => n.id))
      seeded.current = true
      return
    }
    for (const n of notifications) {
      if (seenIds.current.has(n.id)) continue
      seenIds.current.add(n.id)
      if (n.read) continue
      const line =
        n.body && n.body.trim().length > 0
          ? `${n.title}: ${n.body.trim()}`
          : n.title
      toast(line, "bell", 4000)
    }
  }, [listLoaded, notifications, toast])

  return null
}
