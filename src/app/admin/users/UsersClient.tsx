"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../components/Toast";
import BackButton from "../components/BackButton";
import UserRow from "./UserRow";
import UserDetailModal from "../platform/UserDetailModal";
import InviteUserModal from "../platform/InviteUserModal";

interface User {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  role: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  status: "activated" | "pending" | "inactive";
}

interface UsersClientProps {
  currentUserId?: string;
}

function roleLabel(role: string) {
  if (role === "superadmin") return "Superadmin";
  if (role === "admin") return "Admin";
  if (role === "manager") return "Manager";
  if (role === "partner") return "Partner";
  return "Dispatcher";
}

export default function UsersClient({ currentUserId }: UsersClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const fetchUsers = () => {
    setLoading(true);
    fetch("/api/admin/users")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setUsers(data);
        else toast(data.error || "Failed to load users", "x");
      })
      .catch(() => toast("Failed to load users", "x"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="flex items-center justify-between mb-4">
        <BackButton label="Back" />
        <button
          onClick={() => setInviteOpen(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
        >
          + Invite User
        </button>
      </div>

      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-visible relative">
        <table className="w-full border-collapse overflow-visible">
          <thead>
            <tr>
              <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">User</th>
              <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Role</th>
              <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Status</th>
              <th className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-3 py-2 border-b border-[var(--brd)]">Last sign in</th>
              <th className="w-10 px-3 py-2 border-b border-[var(--brd)]" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-[12px] text-[var(--tx3)]">Loading users…</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-12 text-center text-[12px] text-[var(--tx3)]">No users yet. Invite users to get started.</td>
              </tr>
            ) : (
              users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  roleLabel={roleLabel(u.role)}
                  onSelect={() => setSelectedUser(u)}
                  onDeleted={(id) => {
                    setUsers((prev) => prev.filter((x) => x.id !== id));
                    setSelectedUser(null);
                    router.refresh();
                  }}
                  onResendInvite={() => { fetchUsers(); router.refresh(); }}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <InviteUserModal open={inviteOpen} onClose={() => { setInviteOpen(false); fetchUsers(); }} />

      {selectedUser?.role === "partner" && (
        <UserDetailModal open={!!selectedUser} onClose={() => setSelectedUser(null)} user={selectedUser} currentUserId={currentUserId} isPartner />
      )}
      {selectedUser && selectedUser.role !== "partner" && (
        <UserDetailModal
          open={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          user={selectedUser}
          currentUserId={currentUserId}
          onSaved={(updates) => {
            setUsers((prev) => prev.map((x) => (x.id === selectedUser.id ? { ...x, ...updates } : x)));
            setSelectedUser((s) => (s ? { ...s, ...updates } : null));
          }}
          onDeleted={(id) => {
            setUsers((prev) => prev.filter((x) => x.id !== id));
            setSelectedUser(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
