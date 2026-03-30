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
  phone?: string | null;
  specializations?: string[] | null;
  on_vacation?: boolean;
  out_of_office?: boolean;
  max_open_leads?: number | null;
}

interface UserDetailModalProps {
  open: boolean;
  onClose: () => void;
  user: User;
  currentUserId?: string;
  isPartner?: boolean;
  isMoveClient?: boolean;
  moveId?: string | null;
  onSaved?: (updates: Partial<User>) => void;
  onDeleted?: (id: string) => void;
}

export default function UserDetailModal({ open, onClose, user, currentUserId, isPartner, isMoveClient, moveId, onSaved, onDeleted }: UserDetailModalProps) {
  const { toast } = useToast();
  const [name, setName] = useState(user.name || "");
  const [role, setRole] = useState(
    ["owner", "admin", "manager", "dispatcher", "coordinator", "viewer", "sales", "client"].includes(user.role) ? user.role : "dispatcher"
  );
  const [phone, setPhone] = useState(user.phone ?? "");
  const [specInput, setSpecInput] = useState((user.specializations ?? []).join(", "));
  const [onVacation, setOnVacation] = useState(!!user.on_vacation);
  const [outOfOffice, setOutOfOffice] = useState(!!user.out_of_office);
  const [maxOpenLeads, setMaxOpenLeads] = useState(user.max_open_leads ?? 20);
  const [newPassword, setNewPassword] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(user.name || "");
      setRole(
        ["owner", "admin", "manager", "dispatcher", "coordinator", "viewer", "sales", "client"].includes(user.role) ? user.role : "dispatcher"
      );
      setPhone(user.phone ?? "");
      setSpecInput((user.specializations ?? []).join(", "));
      setOnVacation(!!user.on_vacation);
      setOutOfOffice(!!user.out_of_office);
      setMaxOpenLeads(user.max_open_leads ?? 20);
    }
  }, [open, user]);

  const isSelf = currentUserId === user.id;
  const isAdmin = user.role === "admin";
  const assignmentEligibleRoles = ["owner", "coordinator", "sales"];
  const showLeadAssignment =
    !user.id.startsWith("inv-") && assignmentEligibleRoles.includes(user.role);
  // Role can only be changed for users created from User management; move clients and partners are locked.
  const canEditRole = !isSelf && !isAdmin && !isPartner && !isMoveClient;

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

  if (isMoveClient && moveId) {
    return (
      <ModalOverlay open={open} onClose={onClose} title="Client (move)" maxWidth="sm">
        <div className="p-5 space-y-4">
          <p className="text-[13px] text-[var(--tx2)]">
            <strong>{user.name || user.email}</strong> is a move client. They access their move via a magic-link tracking URL sent by email, no account needed.
          </p>
          <p className="text-[12px] text-[var(--tx3)]">
            Use &quot;Resend tracking link&quot; on the move to send them the tracking URL again.
          </p>
          <Link href={`/admin/moves/${moveId}`} className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--gold)] hover:underline">
            View move →
          </Link>
        </div>
      </ModalOverlay>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: {
        name?: string;
        role?: string;
        phone?: string | null;
        specializations?: string[];
        on_vacation?: boolean;
        out_of_office?: boolean;
        max_open_leads?: number;
      } = { name: name.trim() };
      if (canEditRole) payload.role = role;
      if (!user.id.startsWith("inv-")) payload.phone = phone.trim() || null;
      if (showLeadAssignment) {
        payload.specializations = specInput
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean);
        payload.on_vacation = onVacation;
        payload.out_of_office = outOfOffice;
        payload.max_open_leads = maxOpenLeads;
      }
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      const updates: Partial<User> = { name: name.trim() };
      if (payload.role !== undefined) updates.role = payload.role;
      if (typeof data.role === "string") updates.role = data.role;
      if (payload.phone !== undefined) updates.phone = payload.phone ?? null;
      if (data.phone !== undefined) updates.phone = data.phone;
      if (showLeadAssignment) {
        updates.specializations = payload.specializations;
        updates.on_vacation = payload.on_vacation;
        updates.out_of_office = payload.out_of_office;
        updates.max_open_leads = payload.max_open_leads;
      }
      onSaved?.(updates);
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
              className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Email</label>
            <div className="px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx2)]">
              {user.email}
            </div>
            <p className="text-[10px] text-[var(--tx3)] mt-1">Email cannot be changed</p>
          </div>
          {!user.id.startsWith("inv-") && (
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Phone (SMS)</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 5551234567"
              className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
            />
            <p className="text-[10px] text-[var(--tx3)] mt-1">Used for SMS notifications (e.g. quote viewed, payment received). Use 10 or 11 digits.</p>
          </div>
          )}
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
                onChange={(e) => setRole(e.target.value)}
                disabled={!canEditRole}
                className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none disabled:opacity-60"
              >
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="dispatcher">Dispatcher</option>
                <option value="coordinator">Coordinator</option>
                <option value="viewer">Viewer</option>
                <option value="sales">Sales</option>
              </select>
            )}
          </div>
          {showLeadAssignment && (
            <div className="rounded-lg border border-[var(--brd)] bg-[var(--card)]/40 p-4 space-y-3">
              <h3 className="text-[11px] font-bold tracking-wider text-[var(--tx3)] uppercase">Lead assignment</h3>
              <p className="text-[10px] text-[var(--tx3)]">
                Specializations are matched to lead service type (lowercase). Example: local_move, office_move, b2b_delivery
              </p>
              <div>
                <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Specializations</label>
                <input
                  type="text"
                  value={specInput}
                  onChange={(e) => setSpecInput(e.target.value)}
                  placeholder="local_move, office_move, b2b_delivery"
                  className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Max open leads</label>
                <input
                  type="number"
                  min={1}
                  max={500}
                  value={maxOpenLeads}
                  onChange={(e) => setMaxOpenLeads(parseInt(e.target.value, 10) || 20)}
                  className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
                />
              </div>
              <label className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer">
                <input type="checkbox" checked={onVacation} onChange={(e) => setOnVacation(e.target.checked)} className="accent-[var(--gold)]" />
                On vacation (excluded from smart assignment)
              </label>
              <label className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer">
                <input type="checkbox" checked={outOfOffice} onChange={(e) => setOutOfOffice(e.target.checked)} className="accent-[var(--gold)]" />
                Out of office
              </label>
            </div>
          )}

          <button type="submit" disabled={saving} className="px-4 py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50">
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
              className="flex-1 px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
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
                className="px-4 py-1.5 rounded text-[12px] font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-all"
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
