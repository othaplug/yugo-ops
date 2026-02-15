"use client";

import { useState, useEffect } from "react";

export default function ClientDate() {
  const [date, setDate] = useState<string>("");

  useEffect(() => {
    setDate(new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }));
  }, []);

  if (!date) return null;
  return <span suppressHydrationWarning>{date}</span>;
}
