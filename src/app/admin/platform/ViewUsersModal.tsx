"use client";

import { useState, useEffect } from "react";
import { useToast } from "../components/Toast";
import ModalOverlay from "../components/ModalOverlay";
import UserDetailModal from "./UserDetailModal";

interface User {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string | null;
  last_sign_in_at: string | null;
  status: "activated" | "inactive";
}

interface ViewUsersModalProps {
  open: boolean;
  onClose: () => void;
  currentUserId?: string;
}

export default function ViewUsersModal({ open, onClose, currentUserId }: ViewUsersModalProps) {
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetch("/api/admin/users")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setUsers(data);
          else toast(data.error || "Failed to load users", "x");
        })
        .catch(() => toast("Failed to load users", "x"))
        .finally(() => setLoading(false));
    }
  }, [open, toast]);

  const handleUserDeleted = (id: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== id));
    setSelectedUser(null);
  };

  const handleUserUpdated = (updated: Partial<User>) => {
    if (!selectedUser) return;
    setUsers((prev) => prev.map((u) => (u.id === selectedUser.id ? { ...u, ...updated } : u)));
    setSelectedUser((u) => (u ? { ...u, ...updated } : null));
  };

  return (
    <>
      <ModalOverlay open={open} onClose={onClose} title="Users" maxWidth="lg">
        <div className="p-5">
          {loading ? (
            <div className="py-8 text-center text-[13px] text-[var(--tx3)]">Loading users…</div>
          ) : users.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-[var(--tx3)]">No users yet. Invite users to get started.</div>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {users.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUser(u)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-[var(--brd)] hover:border-[var(--gold)] bg-[var(--bg)] hover:bg-[var(--card)] transition-all text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-[var(--tx)] truncate">{u.name || u.email}</div>
                    <div className="text-[11px] text-[var(--tx3)] truncate">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${u.status === "activated" ? "bg-[rgba(45,159,90,0.15)] text-[var(--grn)]" : "bg-[var(--brd)] text-[var(--tx3)]"}`}>
                      {u.status === "activated" ? "Activated" : "Inactive"}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--gdim)] text-[var(--gold)]">
                      {u.role === "admin" ? "Admin" : "Dispatcher"}
                    </span>
                    <span className="text-[9px] text-[var(--tx3)]">Email sent</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </ModalOverlay>

      {selectedUser && (
        <UserDetailModal
          open={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          user={selectedUser}
          currentUserId={currentUserId}
          onSaved={handleUserUpdated}
          onDeleted={handleUserDeleted}
        />
      )}
    </>
  );
}
