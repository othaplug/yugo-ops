"use client";

import { useState, useEffect } from "react";
import { formatPlatformDisplay } from "@/lib/date-format";

export default function ClientDate() {
  const [date, setDate] = useState<string>("");

  useEffect(() => {
    setDate(formatPlatformDisplay(new Date(), { weekday: "long", month: "long", day: "numeric" }, ""));
  }, []);

  if (!date) return null;
  return <span suppressHydrationWarning>{date}</span>;
}
