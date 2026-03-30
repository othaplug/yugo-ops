"use client";

import { getProjectItemStatus } from "@/lib/project-item-status";

export interface VendorStatusItem {
  id: string;
  item_name: string;
  vendor_name?: string | null;
  vendor?: string | null;
  expected_delivery_date?: string | null;
  received_date?: string | null;
  delivered_date?: string | null;
  item_status?: string | null;
  status?: string | null;
}

const COMPACT_STATUS: Record<string, { label: string; color: string }> = {
  done:   { label: "Done",   color: "text-emerald-500" },
  transit: { label: "Transit", color: "text-amber-500" },
  wait:   { label: "Wait",   color: "text-amber-400" },
  late:   { label: "Late",   color: "text-red-500" },
};

function getCompactStatus(st: string): "done" | "transit" | "wait" | "late" {
  if (["delivered", "installed"].includes(st)) return "done";
  if (["shipped", "in_transit"].includes(st)) return "transit";
  if (st === "issue_reported") return "late";
  return "wait";
}

export function VendorStatusCompactTable({ inventory }: { inventory: VendorStatusItem[] }) {
  const getVendor = (item: VendorStatusItem) => item.vendor_name || item.vendor || "No Vendor";
  if (inventory.length === 0) return null;
  const vendorGroups = Array.from(new Set(inventory.map(getVendor)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[var(--brd)]/50">
            <th className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2.5 pr-4">Vendor</th>
            <th className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2.5 pr-4">Items</th>
            <th className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2.5 pr-4">Status</th>
            <th className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] py-2.5 text-right">ETA</th>
          </tr>
        </thead>
        <tbody>
          {vendorGroups.map((vendorName) => {
            const items = inventory.filter((i) => getVendor(i) === vendorName);
            const itemNames = items.map((i) => i.item_name).join(", ");
            const statuses = items.map((i) => getCompactStatus(getProjectItemStatus(i)));
            const worstStatus = statuses.includes("late") ? "late" : statuses.includes("transit") ? "transit" : statuses.includes("wait") ? "wait" : "done";
            const cfg = COMPACT_STATUS[worstStatus];
            const etaDates = items
              .map((i) => {
                const st = getProjectItemStatus(i);
                if (["delivered", "installed"].includes(st)) return i.delivered_date || i.received_date || null;
                return i.expected_delivery_date || null;
              })
              .filter(Boolean) as string[];
            const eta = etaDates.length > 0
              ? new Date(etaDates.sort().pop()!).toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "-";
            return (
              <tr key={vendorName} className="border-b border-[var(--brd)]/30 hover:bg-[var(--bg)]/30 transition-colors">
                <td className="py-2.5 pr-4 text-[13px] font-semibold text-[var(--tx)]">{vendorName}</td>
                <td className="py-2.5 pr-4 text-[12px] text-[var(--tx2)]">{itemNames}</td>
                <td className="py-2.5 pr-4">
                  <span className={`text-[11px] font-bold ${cfg.color}`}>{cfg.label}</span>
                </td>
                <td className="py-2.5 text-[11px] text-[var(--tx3)] text-right">{eta}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
