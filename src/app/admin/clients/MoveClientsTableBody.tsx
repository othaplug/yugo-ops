"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "../components/Toast";
import ModalOverlay from "../components/ModalOverlay";
import { formatMoveDate } from "@/lib/date-format";
import { formatCurrency } from "@/lib/format-currency";

type MoveClient = {
  id: string;
  name: string;
  type: string;
  contact_name: string | null;
  email: string | null;
  outstanding_balance?: number | null;
  move_type?: string;
  move_date?: string | null;
  move_status?: string;
  estimate?: number;
};

export default function MoveClientsTableBody({ clients }: { clients: MoveClient[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpenId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/organizations/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      toast("Client deleted", "check");
      setDeleteConfirmId(null);
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to delete", "x");
    } finally {
      setDeleting(false);
    }
  };

  if (clients.length === 0) {
    return (
      <tr>
        <td colSpan={7} className="px-4 py-12 text-center text-[12px] text-[var(--tx3)]">
          No move clients yet. <Link href="/admin/clients/new" className="text-[var(--gold)] hover:underline">Add one</Link>
        </td>
      </tr>
    );
  }

  return (
    <>
      {clients.map((c) => (
        <tr
          key={c.id}
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest("a") || target.closest("button") || target.closest("[data-menu]")) return;
            router.push(`/admin/clients/${c.id}`);
          }}
          className="hover:bg-[var(--gdim)] transition-colors cursor-pointer group"
        >
          <td className="pl-4 sm:pl-3 pr-3 py-2 border-b border-[var(--brd)]">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold group-hover:text-[var(--gold)] transition-colors">{c.name}</span>
              {(() => {
                const s = (c.move_status || "").toLowerCase();
                const isActive = ["confirmed", "scheduled", "in_progress"].includes(s);
                const isCompleted = s === "completed";
                if (isActive) return <span className="inline-flex px-2 py-[2px] rounded text-[8px] font-bold bg-[var(--grdim)] text-[var(--grn)]">Active</span>;
                if (isCompleted) return <span className="inline-flex px-2 py-[2px] rounded text-[8px] font-bold bg-[var(--grdim)] text-[var(--grn)]">Completed</span>;
                if (s === "cancelled") return <span className="inline-flex px-2 py-[2px] rounded text-[8px] font-bold bg-[var(--rdim)] text-[var(--red)]">Cancelled</span>;
                return null;
              })()}
            </div>
          </td>
          <td className="px-3 py-2 text-[10px] capitalize border-b border-[var(--brd)]">{c.move_type === "office" ? "Commercial" : "Residential"}</td>
          <td className="hidden sm:table-cell px-3 py-2 border-b border-[var(--brd)]">
            <div className="text-[9px]">{c.contact_name}</div>
            <div className="text-[9px] text-[var(--tx3)]">{c.email}</div>
          </td>
          <td className="hidden md:table-cell px-3 py-2 text-[10px] border-b border-[var(--brd)]">{c.move_date ? formatMoveDate(c.move_date) : "—"}</td>
          <td className="px-3 py-2 border-b border-[var(--brd)]">
            <span className={`inline-flex px-2 py-[2px] rounded text-[8px] font-bold ${
              c.move_status === "completed" ? "bg-[var(--grdim)] text-[var(--grn)]" :
              c.move_status === "cancelled" ? "bg-[var(--rdim)] text-[var(--red)]" :
              "bg-[var(--gdim)] text-[var(--gold)]"
            }`}>
              {(c.move_status || "—").replace("_", " ")}
            </span>
          </td>
          <td className="px-3 py-2 text-[10px] border-b border-[var(--brd)]">
            {(c.outstanding_balance ?? 0) > 0 ? formatCurrency(c.outstanding_balance) : "—"}
          </td>
          <td className="px-3 py-2 border-b border-[var(--brd)] w-10" onClick={(e) => e.stopPropagation()}>
            <div className="relative flex justify-end" ref={menuOpenId === c.id ? menuRef : undefined} data-menu>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setMenuOpenId((id) => (id === c.id ? null : c.id)); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-[var(--card)] transition-all"
                aria-label="Actions"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-[var(--tx3)]">
                  <circle cx="12" cy="6" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="18" r="1.5" />
                </svg>
              </button>
              {menuOpenId === c.id && (
                <div className="absolute right-0 top-full mt-1 py-1 bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-xl z-[100] min-w-[140px]">
                  <Link href={`/admin/clients/${c.id}`} className="block w-full text-left px-3 py-2 text-[10px] font-medium text-[var(--tx2)] hover:bg-[var(--gdim)] hover:text-[var(--gold)]" onClick={() => setMenuOpenId(null)}>View</Link>
                  <Link href={`/admin/clients/${c.id}?edit=1`} className="block w-full text-left px-3 py-2 text-[10px] font-medium text-[var(--tx2)] hover:bg-[var(--gdim)] hover:text-[var(--gold)]" onClick={() => setMenuOpenId(null)}>Edit</Link>
                  <button type="button" onClick={() => { setMenuOpenId(null); setDeleteConfirmId(c.id); }} className="w-full text-left px-3 py-2 text-[10px] font-medium text-[var(--red)] hover:bg-[var(--rdim)]">Delete</button>
                </div>
              )}
            </div>
          </td>
        </tr>
      ))}

      {typeof document !== "undefined" && deleteConfirmId && createPortal(
        <ModalOverlay open onClose={() => setDeleteConfirmId(null)} title="Delete client?" maxWidth="sm">
          <div className="p-5 space-y-4">
            <p className="text-[12px] text-[var(--tx2)]">This will remove the client from the list. Moves or invoices linked to them will not be deleted. Continue?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteConfirmId(null)} className="flex-1 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)]">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirmId)} disabled={deleting} className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-[var(--red)] text-white disabled:opacity-50">{deleting ? "Deleting…" : "Delete"}</button>
            </div>
          </div>
        </ModalOverlay>,
        document.body
      )}
    </>
  );
}
