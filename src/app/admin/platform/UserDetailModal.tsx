"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useToast } from "../components/Toast";
import ModalOverlay from "../components/ModalOverlay";

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

interface UserDetailModalProps {
  open: boolean;
  onClose: () => void;
  user: User;
  currentUserId?: string;
  isPartner?: boolean;
  onSaved?: (updates: Partial<User>) => void;
  onDeleted?: (id: string) => void;
}

export default function UserDetailModal({ open, onClose, user, currentUserId, isPartner, onSaved, onDeleted }: UserDetailModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState(user.name || "");
  const [role, setRole] = useState(user.role === "admin" ? "admin" : user.role === "manager" ? "manager" : "dispatcher");
  const [newPassword, setNewPassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(user.name || "");
      setRole(user.role === "admin" ? "admin" : user.role === "manager" ? "manager" : "dispatcher");
    }
  }, [open, user]);

  const isSelf = currentUserId === user.id;
  const isAdmin = user.role === "admin";
  const canEditRole = !isSelf && !isAdmin && !isPartner;

  if (isPartner) {
    const orgId = user.id.replace("partner-", "");
    return (
      <ModalOverlay open={open} onClose={onClose} title="Partner User" maxWidth="sm">
        <div className="p-5 space-y-4">
          <p className="text-[13px] text-[var(--tx2)]">
            {user.name || user.email} is a partner with portal access. Manage them from the Clients page.
          </p>
          <Link href={`/admin/clients/${orgId}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--gold)] hover:underline">
            View client profile →
          </Link>
        </div>
      </ModalOverlay>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), role: canEditRole ? role : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      onSaved?.({ name: name.trim(), role });
      toast("User updated", "check");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to update", "x");
    } finally {
      setSaving(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      toast("Password must be at least 8 characters", "x");
      return;
    }
    setResetting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      setNewPassword("");
      toast("Password reset. User must change it on next login.", "check");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to reset", "x");
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      onDeleted?.(user.id);
      onClose();
      toast("User deleted", "check");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to delete", "x");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <ModalOverlay open={open} onClose={onClose} title="User Details" maxWidth="md">
      <div className="p-5 space-y-5">
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Email</label>
            <div className="px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx2)]">
              {user.email}
            </div>
            <p className="text-[10px] text-[var(--tx3)] mt-1">Email cannot be changed</p>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Role</label>
            {isAdmin ? (
              <div className="px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx2)] flex items-center gap-2">
                <span className="w-2 h-2 bg-[var(--gold)] rounded-full" />
                Admin (cannot be changed)
              </div>
            ) : (
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as "admin" | "manager" | "dispatcher")}
                disabled={!canEditRole}
                className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none disabled:opacity-60"
              >
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="dispatcher">Dispatcher</option>
              </select>
            )}
          </div>
          <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        {!user.id.startsWith("inv-") && (
        <div className="border-t border-[var(--brd)] pt-5 space-y-4">
          <h3 className="text-[12px] font-bold text-[var(--tx2)]">Reset password</h3>
          <form onSubmit={handleResetPassword} className="flex gap-2">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password (min 8 chars)"
              minLength={8}
              className="flex-1 px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            />
            <button type="submit" disabled={resetting || !newPassword} className="px-4 py-2.5 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] disabled:opacity-50">
              {resetting ? "Resetting…" : "Reset"}
            </button>
          </form>
        </div>
        )}

        {!isSelf && (
          <div className="border-t border-[var(--brd)] pt-5">
            <h3 className="text-[12px] font-bold text-[var(--red)] mb-2">Danger zone</h3>
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2.5 rounded-lg text-[12px] font-semibold border border-[var(--red)]/50 text-[var(--red)] hover:bg-[var(--red)]/10"
              >
                Delete user
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-[12px] text-[var(--tx2)]">Are you sure? This cannot be undone. The user will be removed from the database and will no longer be able to sign in.</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2.5 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--red)] text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalOverlay>
  );
}
