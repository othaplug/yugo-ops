"use client";

import { useToast } from "../components/Toast";

export default function Enable2FAButton() {
  const { toast } = useToast();
  return (
    <button
      onClick={() => toast("2FA setup coming soon", "lock")}
      className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
    >
      Enable 2FA
    </button>
  );
}
