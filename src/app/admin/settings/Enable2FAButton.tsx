"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";

export default function Enable2FAButton({ enabled }: { enabled?: boolean }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleEnable = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account/2fa/enable", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to enable");
      toast("2FA enabled. A code will be sent to your email on each login.", "check");
      window.location.reload();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed", "x");
    } finally {
      setLoading(false);
    }
  };

  if (enabled) {
    return (
      <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-[rgba(45,159,90,0.12)] text-[var(--grn)]">
        Enabled
      </span>
    );
  }

  return (
    <button
      onClick={handleEnable}
      disabled={loading}
      className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all disabled:opacity-50"
    >
      {loading ? "Enabling…" : "Enable 2FA"}
    </button>
  );
}
