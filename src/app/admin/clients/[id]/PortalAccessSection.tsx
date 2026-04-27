"use client";

import { useState, useEffect, useMemo } from "react";
import { useToast } from "../../components/Toast";
import { Icon } from "@/components/AppIcons";
import ModalOverlay from "../../components/ModalOverlay";
import { getPartnerLabelsForPartner } from "@/utils/partnerType";

interface PortalUser {
  user_id: string;
  email: string;
  name?: string;
  status: string;
}

export default function PortalAccessSection({
  orgId,
  orgName,
  partnerVertical,
}: {
  orgId: string;
  orgName: string;
  /** organizations.vertical or type */
  partnerVertical?: string | null;
}) {
  const { toast } = useToast();
  const labels = useMemo(
    () =>
      getPartnerLabelsForPartner({
        vertical: partnerVertical,
        type: partnerVertical,
      }),
    [partnerVertical],
  );
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [resetUser, setResetUser] = useState<PortalUser | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    fetch(`/api/admin/organizations/${orgId}/portal-users`)
      .then((r) => r.json())
      .then((data) => (Array.isArray(data) ? setUsers(data) : setUsers([])))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, [orgId]);

  const handleRevoke = async (userId: string) => {
    setRevoking(userId);
    try {
      const res = await fetch(
        `/api/admin/organizations/${orgId}/revoke-portal-user`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to revoke");
      toast("Portal access revoked", "check");
      fetchUsers();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to revoke", "x");
    } finally {
      setRevoking(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast("Email is required", "x");
      return;
    }
    if (!password.trim() || password.length < 8) {
      toast("Password must be at least 8 characters", "x");
      return;
    }
    setInviteLoading(true);
    try {
      const res = await fetch(
        `/api/admin/organizations/${orgId}/invite-portal-user`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: email.trim(),
            name: name.trim(),
            password,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to invite");
      toast("Portal invitation sent", "mail");
      setInviteOpen(false);
      setEmail("");
      setName("");
      setPassword("");
      fetchUsers();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to invite", "x");
    } finally {
      setInviteLoading(false);
    }
  };

  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
    let pwd = "";
    const arr = new Uint8Array(12);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 12; i++) pwd += chars[arr[i]! % chars.length];
    setPassword(pwd);
  };

  const generateResetPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
    let pwd = "";
    const arr = new Uint8Array(12);
    crypto.getRandomValues(arr);
    for (let i = 0; i < 12; i++) pwd += chars[arr[i]! % chars.length];
    setResetPassword(pwd);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser) return;
    if (!resetPassword.trim() || resetPassword.length < 8) {
      toast("Password must be at least 8 characters", "x");
      return;
    }
    setResetLoading(true);
    try {
      const res = await fetch(
        `/api/admin/organizations/${orgId}/reset-partner-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: resetUser.user_id,
            new_password: resetPassword,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password");
      toast("New password set and email sent to partner", "mail");
      setResetUser(null);
      setResetPassword("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to reset password", "x");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden mb-6">
      <div className="px-5 py-5 md:px-6 md:py-5 border-b border-[var(--brd)] bg-[var(--bg2)] flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h3 className="font-heading text-[16px] md:text-[17px] font-bold text-[var(--tx)] flex items-center gap-2.5 leading-snug">
            <Icon name="lock" className="w-[16px] h-[16px] shrink-0" aria-hidden /> Portal Access
          </h3>
          <p className="text-[12px] text-[var(--tx3)] mt-2 leading-relaxed max-w-2xl">
            Manage who at this partner can log in to {labels.portalDescription}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInviteOpen(true)}
          className="admin-btn admin-btn-sm admin-btn-primary shrink-0 self-start sm:self-center"
        >
          + Invite Portal User
        </button>
      </div>
      <div className="px-5 py-5 md:px-6">
        {loading ? (
          <div className="py-6 text-center text-[12px] text-[var(--tx3)]">
            Loading…
          </div>
        ) : users.length === 0 ? (
          <div className="py-6 text-center text-[12px] text-[var(--tx3)]">
            No portal users yet. Invite someone to give them access.
          </div>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.user_id}
                className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[var(--brd)] bg-[var(--bg)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[var(--tx)] break-words">
                    {u.name || u.email?.split("@")[0] || "-"}
                  </div>
                  <div className="text-[11px] text-[var(--tx3)] break-all mt-0.5">
                    {u.email}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`dt-badge tracking-[0.04em] ${
                      u.status === "activated"
                        ? "text-[var(--grn)]"
                        : "text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {u.status === "activated" ? "Activated" : "Pending"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setResetUser(u)}
                    className="px-2.5 py-1 rounded text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
                  >
                    Reset password
                  </button>
                  <button
                    onClick={() => handleRevoke(u.user_id)}
                    disabled={revoking === u.user_id}
                    className="px-2.5 py-0.5 rounded text-[10px] font-semibold bg-[var(--red)] text-white hover:opacity-90 transition-all disabled:opacity-50"
                  >
                    {revoking === u.user_id ? "Revoking…" : "Revoke"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalOverlay
        open={!!resetUser}
        onClose={() => {
          setResetUser(null);
          setResetPassword("");
        }}
        title="Reset partner password"
        maxWidth="md"
      >
        {resetUser && (
          <form onSubmit={handleResetPassword} className="p-5 space-y-4">
            <p className="text-[12px] text-[var(--tx3)]">
              Set a new temporary password for{" "}
              <strong>{resetUser.name || resetUser.email}</strong>. They will
              receive an email with the new password and login link.
            </p>
            <div>
              <label className="admin-premium-label">
                New temporary password *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  required
                  minLength={8}
                  className="admin-premium-input flex-1"
                />
                <button
                  type="button"
                  onClick={generateResetPassword}
                  className="px-3 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
                >
                  Generate
                </button>
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setResetUser(null);
                  setResetPassword("");
                }}
                className="admin-btn admin-btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={resetLoading}
                className="admin-btn admin-btn-primary flex-1"
              >
                {resetLoading ? "Sending…" : "Set password & send email"}
              </button>
            </div>
          </form>
        )}
      </ModalOverlay>

      <ModalOverlay
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title="Invite Portal User"
        maxWidth="md"
      >
        <form onSubmit={handleInvite} className="p-5 space-y-4">
          <p className="text-[12px] text-[var(--tx3)]">
            Invite someone at {orgName} to log in. They can{" "}
            {labels.portalDescription}.
          </p>
          <div>
            <label className="admin-premium-label">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
              required
              className="admin-premium-input w-full"
            />
          </div>
          <div>
            <label className="admin-premium-label">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="admin-premium-input w-full"
            />
          </div>
          <div>
            <label className="admin-premium-label">Temporary Password *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                minLength={8}
                className="admin-premium-input flex-1"
              />
              <button
                type="button"
                onClick={generatePassword}
                className="px-3 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
              >
                Generate
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setInviteOpen(false)}
              className="admin-btn admin-btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={inviteLoading}
              className="admin-btn admin-btn-primary flex-1"
            >
              {inviteLoading ? "Sending…" : "Send Invitation"}
            </button>
          </div>
        </form>
      </ModalOverlay>
    </div>
  );
}
