"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/AppIcons";

type InventoryItem = {
  id: string;
  room: string;
  item_name: string;
  status: string;
  box_number: string | null;
  sort_order: number;
};

const STATUS_LABELS: Record<string, string> = {
  not_packed: "Not packed",
  packed: "Packed",
  in_transit: "In transit",
  delivered: "Delivered",
};

const STATUS_COLORS: Record<string, string> = {
  not_packed: "text-[var(--tx3)]",
  packed: "text-[var(--org)]",
  in_transit: "text-[var(--gold)]",
  delivered: "text-[var(--grn)]",
};

export default function TrackInventory({ moveId, token }: { moveId: string; token: string }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/track/moves/${moveId}/inventory?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setItems(data.items ?? []);
      })
      .catch(() => { if (!cancelled) setItems([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [moveId, token]);

  const byRoom = items.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    const room = item.room || "Other";
    if (!acc[room]) acc[room] = [];
    acc[room].push(item);
    return acc;
  }, {});
  const rooms = Object.keys(byRoom).sort();

  if (loading) {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] flex items-center gap-2 mb-4">
          <Icon name="package" className="w-[12px] h-[12px]" />
          Inventory
        </h3>
        <p className="text-[12px] text-[var(--tx2)]">Loading...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] flex items-center gap-2 mb-4">
          <Icon name="package" className="w-[12px] h-[12px]" />
          Inventory
        </h3>
        <p className="text-[12px] text-[var(--tx2)]">No inventory items logged yet. Your coordinator will add items as your move is prepared.</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--brd)] flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-[var(--tx)] flex items-center gap-2">
          <Icon name="package" className="w-[12px] h-[12px]" />
          Inventory ({items.length} items)
        </h3>
      </div>
      <div className="p-5 space-y-4">
        {rooms.map((room) => (
          <div key={room} className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] overflow-hidden">
            <div className="border-b border-[var(--brd)] bg-[var(--gdim)] px-4 py-2.5">
              <h4 className="text-[12px] font-bold text-[var(--gold)]">{room}</h4>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="text-[10px] font-semibold uppercase text-[var(--tx3)] px-4 py-2 border-b border-[var(--brd)]">Item</th>
                  <th className="text-[10px] font-semibold uppercase text-[var(--tx3)] px-4 py-2 border-b border-[var(--brd)]">Status</th>
                  <th className="text-[10px] font-semibold uppercase text-[var(--tx3)] px-4 py-2 border-b border-[var(--brd)]">Box</th>
                </tr>
              </thead>
              <tbody>
                {byRoom[room].map((item) => (
                  <tr key={item.id} className="border-b border-[var(--brd)] last:border-0">
                    <td className="px-4 py-2.5 text-[11px] font-medium text-[var(--tx)]">{item.item_name}</td>
                    <td className={`px-4 py-2.5 text-[10px] font-semibold ${STATUS_COLORS[item.status] ?? "text-[var(--tx3)]"}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </td>
                    <td className="px-4 py-2.5 text-[10px] font-mono text-[var(--tx2)]">{item.box_number || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

