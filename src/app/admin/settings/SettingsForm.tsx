"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "../components/Toast";

export default function SettingsForm() {
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast("Password must be at least 6 characters", "x");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast("Error: " + error.message, "x");
    } else {
      toast("Password updated successfully", "check");
      setNewPassword("");
    }
    setLoading(false);
  };

  return (
    <div className="flex gap-2">
      <input
        type="password"
        placeholder="New password (min 6 characters)..."
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="flex-1 px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none transition-colors"
      />
      <button
        onClick={handleChangePassword}
        disabled={loading}
        className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50 whitespace-nowrap"
      >
        {loading ? "Updating..." : "Update"}
      </button>
    </div>
  );
}