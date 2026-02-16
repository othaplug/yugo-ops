"use client";

import { useState, useRef, useEffect } from "react";
import { useToast } from "../components/Toast";
import ModalOverlay from "../components/ModalOverlay";

interface User {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  role: string;
  status: string;
  last_sign_in_at?: string | null;
}

interface UserRowProps {
  user: User;
  roleLabel: string;
  onSelect: () => void;
  onUpdated?: (updates: Partial<User>) => void;
  onDeleted?: (id: string) => void;
  onResendInvite?: () => void;
}

export default function UserRow({ user, roleLabel, onSelect, onDeleted, onResendInvite }: UserRowProps) {
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const canEdit = user.role !== "partner";
  const canResend = user.role !== "partner" && user.role !== "superadmin";

  const handleResendInvite = async () => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}/resend-invite`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send");
      toast("Invitation email sent", "mail");
      setMenuOpen(false);
      onResendInvite?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to send", "x");
    }
  };

  return (
    <>
      <tr
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (!target.closest("button") && !target.closest("[data-dots-menu]")) onSelect();
        }}
        className="hover:bg-[var(--gdim)] transition-colors cursor-pointer group"
      >
        <td className="px-3 py-2 border-b border-[var(--brd)]">
          <div className="text-[9px]">{user.name || user.email}</div>
          <div className="text-[9px] text-[var(--tx3)]">{user.email}</div>
        </td>
        <td className="px-3 py-2 border-b border-[var(--brd)]">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[var(--gdim)] text-[var(--gold)]">{roleLabel}</span>
        </td>
        <td className="px-3 py-2 border-b border-[var(--brd)]">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            user.status === "activated" ? "bg-[rgba(45,159,90,0.15)] text-[var(--grn)]" :
            user.status === "pending" ? "bg-[rgba(201,169,98,0.15)] text-[var(--gold)]" :
            "bg-[var(--brd)] text-[var(--tx3)]"
          }`}>
            {user.status === "activated" ? "Active" : user.status === "pending" ? "Pending" : "Inactive"}
          </span>
        </td>
        <td className="px-3 py-2 text-[10px] border-b border-[var(--brd)]">{user.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleDateString() : "—"}</td>
        <td className="px-3 py-2 border-b border-[var(--brd)] w-10">
          <div className="relative" ref={menuRef} data-dots-menu>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-[var(--card)] transition-all"
              aria-label="Actions"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--tx3)]">
                <circle cx="12" cy="6" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="18" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 bottom-full mb-1 py-1 bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-xl z-[100] min-w-[140px]">
                <button type="button" onClick={() => { setMenuOpen(false); onSelect(); }} className="w-full text-left px-3 py-2 text-[10px] font-medium text-[var(--tx2)] hover:bg-[var(--gdim)] hover:text-[var(--gold)]">View</button>
                {canEdit && <button type="button" onClick={() => { setMenuOpen(false); onSelect(); }} className="w-full text-left px-3 py-2 text-[10px] font-medium text-[var(--tx2)] hover:bg-[var(--gdim)] hover:text-[var(--gold)]">Edit</button>}
                {canResend && <button type="button" onClick={() => handleResendInvite()} className="w-full text-left px-3 py-2 text-[10px] font-medium text-[var(--tx2)] hover:bg-[var(--gdim)] hover:text-[var(--gold)]">Resend invite</button>}
                {canEdit && <button type="button" onClick={() => { setMenuOpen(false); setDeleteConfirm(true); }} className="w-full text-left px-3 py-2 text-[10px] font-medium text-[var(--red)] hover:bg-[var(--red)]/10">Delete</button>}
              </div>
            )}
          </div>
        </td>
      </tr>

      {deleteConfirm && (
        <ModalOverlay open onClose={() => setDeleteConfirm(false)} title="Delete user?" maxWidth="sm">
          <div className="p-5 space-y-4">
            <p className="text-[12px] text-[var(--tx2)]">Are you sure you want to delete <strong>{user.name || user.email}</strong>? This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirm(false)} className="px-4 py-2 rounded-lg text-[12px] font-semibold border border-[var(--brd)]">Cancel</button>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/admin/users/${user.id}`, { method: "DELETE" });
                    if (!res.ok) throw new Error("Failed to delete");
                    setDeleteConfirm(false);
                    onDeleted?.(user.id);
                  } catch {
                    toast("Failed to delete", "x");
                  }
                }}
                className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--red)] text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </>
  );
}
