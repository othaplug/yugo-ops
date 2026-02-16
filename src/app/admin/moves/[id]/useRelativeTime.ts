"use client";

import { useState, useEffect } from "react";

export function useRelativeTime(dateStr: string | null | undefined): string {
  const [relative, setRelative] = useState("—");

  useEffect(() => {
    if (!dateStr) {
      setRelative("—");
      return;
    }
    const update = () => {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHr = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHr / 24);

      if (diffSec < 60) setRelative(diffSec <= 1 ? "just now" : `${diffSec} secs ago`);
      else if (diffMin < 60) setRelative(`${diffMin} min${diffMin === 1 ? "" : "s"} ago`);
      else if (diffHr < 24) setRelative(`${diffHr} hr${diffHr === 1 ? "" : "s"} ago`);
      else if (diffDay < 7) setRelative(`${diffDay} day${diffDay === 1 ? "" : "s"} ago`);
      else if (diffDay < 30) setRelative(`${Math.floor(diffDay / 7)} wk${Math.floor(diffDay / 7) === 1 ? "" : "s"} ago`);
      else setRelative(d.toLocaleDateString());
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [dateStr]);

  return relative;
}
