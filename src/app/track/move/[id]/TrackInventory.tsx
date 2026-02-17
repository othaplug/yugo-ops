"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/AppIcons";
import { ChevronDown } from "lucide-react";

type InventoryItem = {
  id: string;
  room: string;
  item_name: string;
  box_number: string | null;
  sort_order: number;
};

export default function TrackInventory({ moveId, token }: { moveId: string; token: string }) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsedRooms, setCollapsedRooms] = useState<Set<string>>(new Set());

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
      Box: i.box_number || "-",
    }));
    const csv = ["Room,Item,Box", ...rows.map((r) => `"${r.Room}","${r.Item}","${r.Box}"`)].join("\n");
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

  const toggleRoom = (room: string) => {
    setCollapsedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });
  };
  const isExpanded = (room: string) => !collapsedRooms.has(room);

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
      <div className="p-5 space-y-2">
        {rooms.map((room) => {
          const expanded = isExpanded(room);
          const itemCount = byRoom[room].length;
          return (
            <div key={room} className="rounded-lg border border-[#E7E5E4] overflow-hidden transition-colors hover:border-[#D4D4D4]">
              <button
                type="button"
                onClick={() => toggleRoom(room)}
                className="w-full flex items-center justify-between gap-2 bg-[#FAFAF8] px-4 py-2.5 text-left hover:bg-[#F5F5F3] transition-colors cursor-pointer group border-b border-[#E7E5E4]"
              >
                <h4 className="text-[12px] font-bold text-[#C9A962] group-hover:text-[#B8983E] transition-colors">{room}</h4>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] font-medium text-[#999]">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
                  <ChevronDown className={`w-[14px] h-[14px] text-[#999] transition-transform duration-200 ease-out ${expanded ? "rotate-0" : "-rotate-90"}`} />
                </span>
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className="text-[10px] font-semibold uppercase text-[#999] px-4 py-2 border-b border-[#E7E5E4]">Item</th>
                        <th className="text-[10px] font-semibold uppercase text-[#999] px-4 py-2 border-b border-[#E7E5E4]">Box</th>
                      </tr>
                    </thead>
                    <tbody>
                      {byRoom[room].map((item) => (
                        <tr key={item.id} className="border-b border-[#E7E5E4] last:border-0">
                          <td className="px-4 py-2.5 text-[12px] font-medium text-[#1A1A1A]">{item.item_name}</td>
                          <td className="px-4 py-2.5 text-[11px] font-mono text-[#666]">{item.box_number || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

