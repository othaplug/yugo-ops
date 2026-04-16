"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "../components/Toast";

export default function SettingsForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const supabase = createClient();
  const { toast } = useToast();

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast("Please enter your current password", "x");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast("New password must be at least 6 characters", "x");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("New passwords do not match", "x");
      return;
    }
    if (newPassword === currentPassword) {
      toast("New password must be different from your current password", "x");
      return;
    }

    setLoading(true);
    try {
      // Verify current password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Unable to verify identity");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        toast("Current password is incorrect", "x");
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);

      toast("Password updated successfully", "check");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to update password", "x");
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    "admin-premium-input w-full";

  const labelClass = "admin-premium-label admin-premium-label--tight";

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClass}>
          Current Password
        </label>
        <input
          type="password"
          placeholder="Enter your current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={fieldClass}
          autoComplete="current-password"
        />
      </div>
      <div>
        <label className={labelClass}>
          New Password
        </label>
        <input
          type="password"
          placeholder="Min 6 characters"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={fieldClass}
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className={labelClass}>
          Confirm New Password
        </label>
        <input
          type="password"
          placeholder="Re-enter new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
          className={`${fieldClass} ${
            confirmPassword && confirmPassword !== newPassword
              ? "border-[var(--red)] focus:border-[var(--red)]"
              : confirmPassword && confirmPassword === newPassword
              ? "border-[var(--grn)] focus:border-[var(--grn)]"
              : ""
          }`}
          autoComplete="new-password"
        />
        {confirmPassword && confirmPassword !== newPassword && (
          <p className="text-[10px] text-[var(--red)] mt-1.5">Passwords do not match</p>
        )}
      </div>
      <button
        onClick={handleChangePassword}
        disabled={loading}
        className="w-full px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all disabled:opacity-50 mt-1"
      >
        {loading ? "Updating..." : "Update Password"}
      </button>
    </div>
  );
}
