"use client";

import { useEffect, useState, useMemo } from "react";
import { Pencil, Trash2, Plus, ChevronDown } from "lucide-react";
import ModalOverlay from "../../components/ModalOverlay";
import { useToast } from "../../components/Toast";

type InventoryItem = {
  id: string;
  room: string;
  item_name: string;
  box_number: string | null;
  sort_order: number;
};

type ExtraItem = {
  id: string;
  description?: string | null;
  room?: string | null;
  quantity?: number;
  added_at?: string;
  status: string;
  requested_by: string;
};

const DEFAULT_ROOMS = ["Living Room", "Bedroom", "Kitchen", "Bathroom", "Office", "Other"];

export default function MoveInventorySection({ moveId }: { moveId: string }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [extraItems, setExtraItems] = useState<ExtraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [extraLoading, setExtraLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newRoom, setNewRoom] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBox, setEditBox] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [extraActioning, setExtraActioning] = useState<string | null>(null);
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set());
  const [approveExtraModal, setApproveExtraModal] = useState<{ itemId: string } | null>(null);
  const [approveExtraFeeDollars, setApproveExtraFeeDollars] = useState("");
  const { toast } = useToast();

  const handleExtraApprove = async (itemId: string, feeCents?: number) => {
    setExtraActioning(itemId);
    try {
      const body: { status: string; fee_cents?: number } = { status: "approved" };
      if (typeof feeCents === "number" && feeCents > 0) body.fee_cents = feeCents;
      const r = await fetch(`/api/admin/moves/${moveId}/extra-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok || data.error) {
        toast(data.error || "Failed to approve", "x");
        return;
      }
      toast("Extra item approved", "check");
      setApproveExtraModal(null);
      setApproveExtraFeeDollars("");
      fetchExtraItems();
    } finally {
      setExtraActioning(null);
    }
  };

  const confirmExtraApprove = () => {
    if (!approveExtraModal) return;
    const dollars = parseFloat(approveExtraFeeDollars);
    const feeCents = Number.isFinite(dollars) && dollars > 0 ? Math.round(dollars * 100) : undefined;
    handleExtraApprove(approveExtraModal.itemId, feeCents);
  };

  const handleExtraReject = async (itemId: string) => {
    setExtraActioning(itemId);
    try {
      const r = await fetch(`/api/admin/moves/${moveId}/extra-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      const data = await r.json();
      if (!r.ok || data.error) {
        toast(data.error || "Failed to reject", "x");
        return;
      }
      toast("Extra item rejected", "check");
      fetchExtraItems();
    } finally {
      setExtraActioning(null);
    }
  };

  const fetchItems = () => {
    fetch(`/api/admin/moves/${moveId}/inventory`)
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  const fetchExtraItems = () => {
    fetch(`/api/admin/moves/${moveId}/extra-items`)
      .then((r) => r.json())
      .then((data) => setExtraItems(data.items ?? []))
      .catch(() => setExtraItems([]))
      .finally(() => setExtraLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, [moveId]);

  useEffect(() => {
    setExtraLoading(true);
    fetchExtraItems();
  }, [moveId]);

  /** Capitalize first letter of each word (e.g. "couch x2" -> "Couch x2") */
  const capitalizeItem = (s: string): string => {
    const t = s.trim();
    if (!t) return t;
    return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
  };

  /** Parse bulk text: split by newline or comma; normalize "word x2" format; capitalize first letter */
  const parseBulkLines = (text: string): string[] => {
    return text
      .split(/[\n,]+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(.+?)\s+x(\d+)$/i);
        const normalized = m ? `${m[1].trim()} x${m[2]}` : line;
        return capitalizeItem(normalized);
      });
  };

  const parsedBulkItems = useMemo(() => parseBulkLines(bulkText), [bulkText]);
  const [bulkSelected, setBulkSelected] = useState<Set<number>>(new Set());
  const bulkSelectedCount = parsedBulkItems.filter((_, i) => bulkSelected.has(i)).length;
  useEffect(() => {
    setBulkSelected(new Set(parsedBulkItems.map((_, i) => i)));
  }, [bulkText]);

  const toggleBulkItem = (index: number) => {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const handleBulkAdd = async () => {
    if (!newRoom || parsedBulkItems.length === 0) return;
    const toAdd = parsedBulkItems.filter((_, i) => bulkSelected.has(i));
    if (toAdd.length === 0) return;
    setAdding(true);
    let added = 0;
    for (const itemName of toAdd) {
      const res = await fetch(`/api/admin/moves/${moveId}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room: newRoom, item_name: itemName }),
      });
      const data = await res.json();
      if (data.error) {
        toast(data.error, "x");
        break;
      }
      added++;
    }
    if (added > 0) {
      setBulkText("");
      setBulkSelected(new Set());
      fetchItems();
      toast(`Added ${added} item${added > 1 ? "s" : ""}`, "check");
    }
    setAdding(false);
  };

  const handleAdd = () => {
    const name = newItemName.trim();
    if (!name || !newRoom) return;
    setAdding(true);
    fetch(`/api/admin/moves/${moveId}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: newRoom, item_name: newItemQty > 1 ? `${name} x${newItemQty}` : name }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setNewItemName("");
        setNewItemQty(1);
        fetchItems();
      })
      .finally(() => setAdding(false));
  };

  const handleUpdate = (itemId: string) => {
    fetch(`/api/admin/moves/${moveId}/inventory/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ box_number: editBox || null }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setEditingId(null);
        fetchItems();
      });
  };

  const handleDelete = (item: InventoryItem) => {
    setDeleteConfirm(item);
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      const r = await fetch(`/api/admin/moves/${moveId}/inventory/${deleteConfirm.id}`, { method: "DELETE" });
      const data = await r.json();
      if (!r.ok || data.error) {
        toast(data.error || "Failed to remove", "x");
        return;
      }
      setDeleteConfirm(null);
      fetchItems();
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditBox(item.box_number || "");
  };

  const byRoom = items.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    const room = item.room || "Other";
    if (!acc[room]) acc[room] = [];
    acc[room].push(item);
    return acc;
  }, {});
  const rooms = Object.keys(byRoom).sort();

  /** Expand "Table x1, Couch x2" into rows [{ label: "Table", qty: 1 }, { label: "Couch", qty: 2 }] for display */
  const expandItemRow = (item: InventoryItem): { label: string; qty: number }[] => {
    const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s);
    const parts = item.item_name.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) {
      const m = item.item_name.match(/^(.+?)\s+x(\d+)$/i);
      const label = capitalize(m ? m[1].trim() : item.item_name);
      const qty = m ? parseInt(m[2], 10) : 1;
      return [{ label, qty }];
    }
    return parts.map((part) => {
      const m = part.match(/^(.+?)\s+x(\d+)$/i);
      const label = capitalize(m ? m[1].trim() : part);
      const qty = m ? parseInt(m[2], 10) : 1;
      return { label, qty };
    });
  };

  const toggleRoom = (room: string) => {
    setCollapsedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });
  };
  const isExpanded = (room: string) => !collapsedRooms.has(room);

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-xl p-4">
      <h3 className="font-heading text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-3">
        Client inventory
      </h3>
      {loading ? (
        <p className="text-[11px] text-[var(--tx3)]">Loading…</p>
      ) : (
        <>
          {rooms.length === 0 && !adding ? (
            <p className="text-[11px] text-[var(--tx3)] mb-4">No items yet. Add room-by-room items for the client portal.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {rooms.map((room) => {
                const expanded = isExpanded(room);
                const itemCount = byRoom[room].length;
                return (
                <div key={room} className="rounded-lg overflow-hidden border border-[var(--brd)]/40 transition-colors hover:border-[var(--brd)]/60">
                  <button
                    type="button"
                    onClick={() => toggleRoom(room)}
                    className="w-full flex items-center justify-between gap-2 bg-[var(--bg)]/80 px-3 py-2.5 text-left hover:bg-[var(--bg)] transition-colors cursor-pointer group"
                  >
                    <span className="text-[9px] font-bold tracking-wider uppercase text-[var(--gold)] group-hover:text-[var(--gold2)] transition-colors">{room}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="text-[9px] font-medium text-[var(--tx3)]">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                      <ChevronDown className={`w-[14px] h-[14px] text-[var(--tx3)] transition-transform duration-200 ease-out ${expanded ? "rotate-0" : "-rotate-90"}`} />
                    </span>
                  </button>
                  <div
                    className="grid transition-[grid-template-rows] duration-200 ease-out"
                    style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[var(--brd)]/40">
                            <th className="text-[9px] font-semibold uppercase text-[var(--tx3)] px-3 py-2 w-[1%] whitespace-nowrap">Item</th>
                            <th className="text-[9px] font-semibold uppercase text-[var(--tx3)] px-3 py-2 text-right w-14">Qty</th>
                            <th className="text-[9px] font-semibold uppercase text-[var(--tx3)] px-3 py-2 w-20 text-right">Box</th>
                            <th className="w-16" aria-label="Actions" />
                          </tr>
                        </thead>
                        <tbody>
                          {byRoom[room].flatMap((item) => {
                            const rows = expandItemRow(item);
                            return rows.map((r, ri) => (
                              <tr key={`${item.id}-${ri}`} className="border-b border-[var(--brd)]/30 last:border-0 group hover:bg-[var(--bg)]/20 transition-colors">
                                <td className="px-3 py-2 text-[12px] font-medium text-[var(--tx)]">{r.label}</td>
                                <td className="px-3 py-2 text-[12px] text-[var(--tx2)] text-right tabular-nums">{r.qty}</td>
                                <td className="px-3 py-2 text-[11px] text-[var(--tx3)] text-right">
                                  {ri === 0 && (editingId === item.id ? (
                                    <input
                                      type="text"
                                      value={editBox}
                                      onChange={(e) => setEditBox(e.target.value)}
                                      placeholder="Box #"
                                      className="w-14 text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded px-1.5 py-0.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                                    />
                                  ) : item.box_number ? (
                                    <span>Box {item.box_number}</span>
                                  ) : (
                                    "—"
                                  ))}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {ri === 0 && (
                                    <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100">
                                      {editingId === item.id ? (
                                        <>
                                          <button type="button" onClick={() => handleUpdate(item.id)} className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-[var(--grn)] hover:bg-[var(--grdim)]">Save</button>
                                          <button type="button" onClick={() => setEditingId(null)} className="px-1.5 py-0.5 rounded text-[10px] text-[var(--tx3)]">Cancel</button>
                                        </>
                                      ) : (
                                        <>
                                          <button type="button" onClick={() => startEdit(item)} className="p-1 rounded text-[var(--tx3)] hover:bg-[var(--gdim)] hover:text-[var(--gold)]" aria-label="Edit"><Pencil className="w-[11px] h-[11px]" /></button>
                                          <button type="button" onClick={() => handleDelete(item)} className="p-1 rounded text-[var(--tx3)] hover:bg-[var(--rdim)] hover:text-[var(--red)]" aria-label="Delete"><Trash2 className="w-[11px] h-[11px]" /></button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            ));
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
              })}
            </div>
          )}

          {/* Pending extra items (crew/client requests) */}
          {!extraLoading && extraItems.length > 0 && (
            <div className="mb-4 pt-4 border-t border-[var(--brd)]/40">
              <h4 className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Extra items</h4>
              <ul className="space-y-2">
                {extraItems.map((e) => {
                  const pending = e.status === "pending";
                  const desc = `${e.description ?? "—"}${(e.quantity ?? 1) > 1 ? ` x${e.quantity}` : ""}`;
                  const by = e.requested_by === "client" ? "Client" : "Crew";
                  return (
                    <li
                      key={e.id}
                      className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-[11px] ${
                        pending ? "bg-amber-500/10 border-amber-500/30" : "bg-[var(--bg)]/50 border-[var(--brd)]/30"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-[var(--tx)]">{desc}</span>
                        {(e.room || by) && (
                          <span className="ml-2 text-[10px] text-[var(--tx3)]">
                            {e.room ? `${e.room} · ` : ""}{by}
                          </span>
                        )}
                        {!pending && (
                          <span className={`ml-2 text-[10px] font-medium ${e.status === "approved" ? "text-[var(--grn)]" : "text-[var(--red)]"}`}>
                            {e.status}
                          </span>
                        )}
                      </div>
                      {pending && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => { setApproveExtraModal({ itemId: e.id }); setApproveExtraFeeDollars(""); }}
                            disabled={extraActioning === e.id}
                            className="px-2 py-1 rounded-md text-[10px] font-semibold bg-[var(--grn)] text-white hover:opacity-90 disabled:opacity-50"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleExtraReject(e.id)}
                            disabled={extraActioning === e.id}
                            className="px-2 py-1 rounded-md text-[10px] font-semibold bg-[var(--red)] text-white hover:opacity-90 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="space-y-3 pt-1 border-t border-[var(--brd)]/40">
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--bg)]/50 w-fit">
              <button
                type="button"
                onClick={() => setBulkMode(false)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${!bulkMode ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)] shadow-sm" : "text-[var(--tx3)] hover:text-[var(--tx)]"}`}
              >
                Single
              </button>
              <button
                type="button"
                onClick={() => setBulkMode(true)}
                className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-colors ${bulkMode ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)] shadow-sm" : "text-[var(--tx3)] hover:text-[var(--tx)]"}`}
              >
                Bulk add
              </button>
            </div>
            {bulkMode ? (
              <div className="flex flex-col gap-2">
                <div>
                  <label className="block text-[8px] font-medium tracking-wider uppercase text-[var(--tx3)] mb-0.5">Room</label>
                  <select
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value)}
                    className="text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                  >
                    <option value="">Select Room</option>
                    {DEFAULT_ROOMS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[8px] font-medium tracking-wider uppercase text-[var(--tx3)] mb-0.5">Items (comma or newline, e.g. Table x1, Couch x2)</label>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={"Table x1, Couch x2\nCoffee Table"}
                    rows={3}
                    className="w-full text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none resize-y"
                  />
                </div>
                {parsedBulkItems.length > 0 && (
                  <div className="rounded-md border border-[var(--brd)] bg-[var(--bg)]/50 overflow-hidden">
                    <div className="text-[8px] font-semibold uppercase text-[var(--tx3)] px-2 py-1.5 border-b border-[var(--brd)]/50">
                      List — check items to add
                    </div>
                    <ul className="divide-y divide-[var(--brd)]/30 max-h-[200px] overflow-y-auto">
                      {parsedBulkItems.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 px-2 py-2 hover:bg-[var(--bg)]/30 transition-colors">
                          <input
                            type="checkbox"
                            id={`bulk-${i}`}
                            checked={bulkSelected.has(i)}
                            onChange={() => toggleBulkItem(i)}
                            className="rounded border-[var(--brd)] text-[var(--gold)] focus:ring-[var(--gold)]"
                          />
                          <label htmlFor={`bulk-${i}`} className="text-[12px] font-medium text-[var(--tx)] cursor-pointer flex-1">
                            {item}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleBulkAdd}
                  disabled={adding || parsedBulkItems.length === 0 || !newRoom || bulkSelectedCount === 0}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors self-start"
                >
                  <Plus className="w-[11px] h-[11px]" /> Add {bulkSelectedCount > 0 ? `${bulkSelectedCount} selected` : "all"}
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-[8px] font-medium tracking-wider uppercase text-[var(--tx3)] mb-0.5">Room</label>
                  <select
                    value={newRoom}
                    onChange={(e) => setNewRoom(e.target.value)}
                    className="text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                  >
                    <option value="">Select Room</option>
                    {DEFAULT_ROOMS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className="block text-[8px] font-medium tracking-wider uppercase text-[var(--tx3)] mb-0.5">Item</label>
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                    placeholder="e.g. Couch x2"
                    className="w-full text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none"
                  />
                </div>
                <div className="w-14">
                  <label className="block text-[8px] font-medium tracking-wider uppercase text-[var(--tx3)] mb-0.5">Qty</label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
                    className="w-full text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={adding || !newItemName.trim() || !newRoom}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-[11px] h-[11px]" /> Add
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {deleteConfirm && (
        <ModalOverlay open onClose={() => !deleting && setDeleteConfirm(null)} title="Remove item?" maxWidth="sm">
          <div className="p-5 space-y-4">
            <p className="text-[12px] text-[var(--tx2)]">
              Are you sure you want to remove &quot;{deleteConfirm.item_name}&quot; from inventory? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-[var(--red)] text-white disabled:opacity-50"
              >
                {deleting ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {approveExtraModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true" aria-labelledby="approve-extra-modal-title">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 w-full max-w-sm shadow-xl">
            <h2 id="approve-extra-modal-title" className="text-[13px] font-bold text-[var(--tx)] mb-3">Approve extra item</h2>
            <label className="block text-[11px] font-medium text-[var(--tx2)] mb-1">Optional fee ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0"
              value={approveExtraFeeDollars}
              onChange={(e) => setApproveExtraFeeDollars(e.target.value)}
              className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => { setApproveExtraModal(null); setApproveExtraFeeDollars(""); }}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold text-[var(--tx2)] hover:bg-[var(--bg)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmExtraApprove}
                disabled={extraActioning === approveExtraModal.itemId}
                className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--grn)] text-white hover:bg-[var(--grn)]/90 disabled:opacity-50"
              >
                {extraActioning === approveExtraModal.itemId ? "…" : "Approve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
