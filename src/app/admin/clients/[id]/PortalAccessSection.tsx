"use client";

import { useState, useEffect } from "react";
import { useToast } from "../../components/Toast";
import { Icon } from "@/components/AppIcons";
import ModalOverlay from "../../components/ModalOverlay";

interface PortalUser {
  user_id: string;
  email: string;
  name?: string;
  status: string;
}

export default function PortalAccessSection({ orgId, orgName }: { orgId: string; orgName: string }) {
  const { toast } = useToast();
  const [users, setUsers] = useState<PortalUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
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
      const res = await fetch(`/api/admin/organizations/${orgId}/revoke-portal-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
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
      const res = await fetch(`/api/admin/organizations/${orgId}/invite-portal-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), name: name.trim(), password }),
      });
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

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden mb-6">
      <div className="px-5 py-4 border-b border-[var(--brd)] bg-[var(--bg2)] flex items-center justify-between">
        <div>
          <h3 className="font-heading text-[16px] font-bold text-[var(--tx)] flex items-center gap-2">
            <Icon name="lock" className="w-[16px] h-[16px]" /> Portal Access
          </h3>
          <p className="text-[11px] text-[var(--tx3)] mt-0.5">Manage who at this partner can log in to view deliveries and schedule requests.</p>
        </div>
        <button
          onClick={() => setInviteOpen(true)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
        >
          + Invite Portal User
        </button>
      </div>
      <div className="px-5 py-5">
        {loading ? (
          <div className="py-6 text-center text-[12px] text-[var(--tx3)]">Loading…</div>
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
                  <div className="text-[13px] font-semibold text-[var(--tx)] truncate">
                    {u.name || u.email?.split("@")[0] || "—"}
                  </div>
                  <div className="text-[11px] text-[var(--tx3)] truncate">{u.email}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      u.status === "activated" ? "bg-[rgba(45,159,90,0.15)] text-[var(--grn)]" : "bg-[rgba(201,169,98,0.15)] text-[var(--gold)]"
                    }`}
                  >
                    {u.status === "activated" ? "Activated" : "Pending"}
                  </span>
                  <button
                    onClick={() => handleRevoke(u.user_id)}
                    disabled={revoking === u.user_id}
                    className="px-2.5 py-1 rounded text-[10px] font-semibold border border-[var(--red)]/40 text-[var(--red)] hover:bg-[var(--rdim)] transition-all disabled:opacity-50"
                  >
                    {revoking === u.user_id ? "Revoking…" : "Revoke"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ModalOverlay open={inviteOpen} onClose={() => setInviteOpen(false)} title="Invite Portal User" maxWidth="md">
        <form onSubmit={handleInvite} className="p-5 space-y-4">
          <p className="text-[12px] text-[var(--tx3)]">
            Invite someone at {orgName} to log in and view their deliveries.
          </p>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Email *</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
              required
              className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Smith"
              className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Temporary Password *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                minLength={8}
                className="flex-1 px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
              />
              <button type="button" onClick={generatePassword} className="px-3 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)]">
                Generate
              </button>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={() => setInviteOpen(false)} className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)]">
              Cancel
            </button>
            <button type="submit" disabled={inviteLoading} className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] disabled:opacity-50">
              {inviteLoading ? "Sending…" : "Send Invitation"}
            </button>
          </div>
        </form>
      </ModalOverlay>
    </div>
  );
}
