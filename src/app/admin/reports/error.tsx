"use client";
import { useEffect } from "react";
import SectionError from "@/components/admin/SectionError";

const isDev = process.env.NODE_ENV === "development";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (isDev) {
      fetch("/api/debug-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "reports/error.tsx",
          message: "Reports error boundary caught",
          data: { message: error.message, stack: error.stack, digest: error.digest },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
  }, [error]);
  return <SectionError error={error} reset={reset} section="Reports" />;
}
