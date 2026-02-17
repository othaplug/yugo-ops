"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";

type InventoryItem = {
  id: string;
  room: string;
  item_name: string;
  status: string;
  box_number: string | null;
  sort_order: number;
};

const STATUSES = [
  { value: "not_packed", label: "Not packed" },
  { value: "packed", label: "Packed" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
];

const DEFAULT_ROOMS = ["Living Room", "Bedroom", "Kitchen", "Bathroom", "Office", "Other"];

export default function MoveInventorySection({ moveId }: { moveId: string }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newRoom, setNewRoom] = useState(DEFAULT_ROOMS[0]);
  const [newItemName, setNewItemName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editBox, setEditBox] = useState("");

  const fetchItems = () => {
    fetch(`/api/admin/moves/${moveId}/inventory`)
      .then((r) => r.json())
      .then((data) => setItems(data.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchItems();
  }, [moveId]);

  const handleAdd = () => {
    const name = newItemName.trim();
    if (!name) return;
    setAdding(true);
    fetch(`/api/admin/moves/${moveId}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: newRoom, item_name: name, status: "not_packed" }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setNewItemName("");
        fetchItems();
      })
      .finally(() => setAdding(false));
  };

  const handleUpdate = (itemId: string) => {
    fetch(`/api/admin/moves/${moveId}/inventory/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: editStatus, box_number: editBox || null }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setEditingId(null);
        fetchItems();
      });
  };

  const handleDelete = (itemId: string) => {
    if (!confirm("Remove this item from inventory?")) return;
    fetch(`/api/admin/moves/${moveId}/inventory/${itemId}`, { method: "DELETE" })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        fetchItems();
      });
  };

  const startEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setEditStatus(item.status);
    setEditBox(item.box_number || "");
  };

  const byRoom = items.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    const room = item.room || "Other";
    if (!acc[room]) acc[room] = [];
    acc[room].push(item);
    return acc;
  }, {});
  const rooms = Object.keys(byRoom).sort();

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3">
      <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-2">
        Client inventory
      </h3>
      {loading ? (
        <p className="text-[11px] text-[var(--tx3)]">Loading…</p>
      ) : (
        <>
          {rooms.length === 0 && !adding ? (
            <p className="text-[11px] text-[var(--tx3)] mb-2">No items yet. Add room-by-room items for the client portal.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {rooms.map((room) => (
                <div key={room} className="border border-[var(--brd)]/50 rounded-lg overflow-hidden">
                  <div className="bg-[var(--bg2)] px-3 py-1.5 text-[9px] font-semibold tracking-wide uppercase text-[var(--tx3)]">
                    {room}
                  </div>
                  <ul className="divide-y divide-[var(--brd)]/50">
                    {byRoom[room].map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                        {editingId === item.id ? (
                          <>
                            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                              <select
                                value={editStatus}
                                onChange={(e) => setEditStatus(e.target.value)}
                                className="text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                              >
                                {STATUSES.map((s) => (
                                  <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={editBox}
                                onChange={(e) => setEditBox(e.target.value)}
                                placeholder="Box #"
                                className="w-16 text-[10px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                              />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleUpdate(item.id)}
                                className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-[var(--grn)] hover:bg-[var(--grdim)] transition-colors"
                                aria-label="Save"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-2 py-0.5 rounded-md text-[10px] font-medium text-[var(--tx3)] hover:bg-[var(--brd)]/50 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="min-w-0 flex-1">
                              <span className="text-[11px] font-medium text-[var(--tx)]">{item.item_name}</span>
                              {item.box_number && (
                                <span className="ml-2 text-[9px] text-[var(--tx3)]">Box {item.box_number}</span>
                              )}
                              <span className="ml-2 text-[9px] text-[var(--tx3)] capitalize">
                                ({item.status.replace("_", " ")})
                              </span>
                            </div>
                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                className="p-1 rounded-md text-[var(--tx3)] hover:bg-[var(--gdim)] hover:text-[var(--gold)] transition-colors"
                                aria-label="Edit"
                              >
                                <Pencil className="w-[11px] h-[11px]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="p-1 rounded-md text-[var(--tx3)] hover:bg-[var(--rdim)] hover:text-[var(--red)] transition-colors"
                                aria-label="Delete"
                              >
                                <Trash2 className="w-[11px] h-[11px]" />
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[8px] font-medium tracking-wider uppercase text-[var(--tx3)] mb-0.5">Room</label>
              <select
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
                className="text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
              >
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
                placeholder="e.g. Couch, Box 1"
                className="w-full text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={adding || !newItemName.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors"
            >
              <Plus className="w-[11px] h-[11px]" /> Add
            </button>
          </div>
        </>
      )}
    </div>
  );
}
