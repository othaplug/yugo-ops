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
  not_packed: "Ready",
  packed: "Packed",
  in_transit: "In Transit",
  delivered: "Delivered",
};

const STATUS_COLORS: Record<string, string> = {
  not_packed: "text-[#1A1A1A]",
  packed: "text-[#22C55E]",
  in_transit: "text-[#C9A962]",
  delivered: "text-[#22C55E]",
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

  const handleExport = () => {
    const rows = items.map((i) => ({
      Room: i.room || "",
      Item: i.item_name,
      Status: STATUS_LABELS[i.status] ?? i.status,
      Box: i.box_number || "-",
    }));
    const csv = ["Room,Item,Status,Box", ...rows.map((r) => `"${r.Room}","${r.Item}","${r.Status}","${r.Box}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inventory-${moveId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const byRoom = items.reduce<Record<string, InventoryItem[]>>((acc, item) => {
    const room = item.room || "Uncategorized";
    if (!acc[room]) acc[room] = [];
    acc[room].push(item);
    return acc;
  }, {});
  const rooms = Object.keys(byRoom).sort();

  if (loading) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
        <h3 className="text-[14px] font-bold text-[#1A1A1A] flex items-center gap-2 mb-4">
          <Icon name="package" className="w-[12px] h-[12px]" />
          Inventory
        </h3>
        <p className="text-[12px] text-[#666]">Loading...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
        <h3 className="text-[14px] font-bold text-[#1A1A1A] flex items-center gap-2 mb-4">
          <Icon name="package" className="w-[12px] h-[12px]" />
          Inventory
        </h3>
        <p className="text-[12px] text-[#666]">No inventory items logged yet. Your coordinator will add items as your move is prepared.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-[#E7E5E4] flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-[#1A1A1A] flex items-center gap-2">
          <Icon name="package" className="w-[12px] h-[12px]" />
          Inventory ({items.length} items)
        </h3>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-lg px-3 py-1.5 text-[11px] font-semibold border border-[#E7E5E4] text-[#666] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors"
        >
          Export
        </button>
      </div>
      <div className="p-5 space-y-4">
        {rooms.map((room) => (
          <div key={room} className="rounded-lg border border-[#E7E5E4] overflow-hidden">
            <div className="border-b border-[#E7E5E4] bg-[#FAFAF8] px-4 py-2.5">
              <h4 className="text-[12px] font-bold text-[#C9A962]">{room}</h4>
            </div>
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="text-[10px] font-semibold uppercase text-[#999] px-4 py-2 border-b border-[#E7E5E4]">Item</th>
                  <th className="text-[10px] font-semibold uppercase text-[#999] px-4 py-2 border-b border-[#E7E5E4]">Status</th>
                  <th className="text-[10px] font-semibold uppercase text-[#999] px-4 py-2 border-b border-[#E7E5E4]">Box</th>
                </tr>
              </thead>
              <tbody>
                {byRoom[room].map((item) => (
                  <tr key={item.id} className="border-b border-[#E7E5E4] last:border-0">
                    <td className="px-4 py-2.5 text-[12px] font-medium text-[#1A1A1A]">{item.item_name}</td>
                    <td className={`px-4 py-2.5 text-[11px] font-semibold ${STATUS_COLORS[item.status] ?? "text-[#666]"}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] font-mono text-[#666]">{item.box_number || "—"}</td>
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

