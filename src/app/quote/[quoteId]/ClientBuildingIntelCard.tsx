"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Buildings } from "@phosphor-icons/react";
import { premiumShellSectionBorderClass } from "./quote-premium-shell";
import type { PremiumShellKind } from "./quote-premium-shell";
import { QUOTE_EYEBROW_CLASS } from "./quote-shared";

export default function ClientBuildingIntelCard({
  quoteId,
  publicActionToken,
  shellKind,
  fromAccess,
  onDarkSurface,
}: {
  quoteId: string;
  publicActionToken: string;
  shellKind: PremiumShellKind;
  fromAccess: string | null;
  /** Hero / tier island uses wine or signature backdrop */
  onDarkSurface: boolean;
}) {
  const elevator = (fromAccess || "").toLowerCase() === "elevator";
  const [stores, setStores] = useState(false);
  const [highFloor, setHighFloor] = useState(false);
  const [olderElevator, setOlderElevator] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async () => {
    if (!publicActionToken?.trim()) return;
    try {
      await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/client-building-intelligence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: publicActionToken,
          stores_on_lower_floors: stores,
          above_20th_floor: highFloor,
          older_or_small_elevators: olderElevator,
        }),
      });
    } catch {
      /* non-blocking */
    }
  }, [quoteId, publicActionToken, stores, highFloor, olderElevator]);

  useEffect(() => {
    if (!elevator) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void save();
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [elevator, save]);

  if (!elevator) return null;

  const border = premiumShellSectionBorderClass(shellKind);
  const body = onDarkSurface ? "text-[rgba(255,255,255,0.88)]" : "text-[#3D4540]";
  const eyebrow = onDarkSurface ? "text-[rgba(255,255,255,0.72)]" : "text-[#2C3E2D]";
  const iconClass = onDarkSurface ? "text-[rgba(255,255,255,0.9)]" : "text-[#2C3E2D]";
  const hoverRow = onDarkSurface ? "hover:bg-white/[0.06]" : "hover:bg-black/[0.04]";

  return (
    <div
      className={`mb-6 rounded-lg border px-4 py-3.5 ${border} ${
        onDarkSurface ? "bg-black/[0.12]" : "bg-[#FFFBF7]/90"
      }`}
    >
      <div className="flex items-start gap-2.5 mb-2">
        <Buildings
          size={20}
          weight="bold"
          className={iconClass}
          aria-hidden
        />
        <p className={`${QUOTE_EYEBROW_CLASS} ${eyebrow}`}>Your building</p>
      </div>
      <p className={`text-sm leading-relaxed mb-3 ${body}`}>
        A few quick questions so we can plan crew time accurately:
      </p>
      <div className="space-y-2.5">
        <label
          className={`flex items-start gap-3 text-sm leading-relaxed cursor-pointer rounded-md px-1 py-1 -mx-1 ${hoverRow} ${body}`}
        >
          <input
            type="checkbox"
            className={`mt-1 shrink-0 ${onDarkSurface ? "accent-white" : "accent-[#2C3E2D]"}`}
            checked={stores}
            onChange={(e) => setStores(e.target.checked)}
          />
          <span>
            My building has stores or businesses on the lower floors (grocery, restaurants,
            retail)
          </span>
        </label>
        <label
          className={`flex items-start gap-3 text-sm leading-relaxed cursor-pointer rounded-md px-1 py-1 -mx-1 ${hoverRow} ${body}`}
        >
          <input
            type="checkbox"
            className={`mt-1 shrink-0 ${onDarkSurface ? "accent-white" : "accent-[#2C3E2D]"}`}
            checked={highFloor}
            onChange={(e) => setHighFloor(e.target.checked)}
          />
          <span>I live above the 20th floor</span>
        </label>
        <label
          className={`flex items-start gap-3 text-sm leading-relaxed cursor-pointer rounded-md px-1 py-1 -mx-1 ${hoverRow} ${body}`}
        >
          <input
            type="checkbox"
            className={`mt-1 shrink-0 ${onDarkSurface ? "accent-white" : "accent-[#2C3E2D]"}`}
            checked={olderElevator}
            onChange={(e) => setOlderElevator(e.target.checked)}
          />
          <span>My building is older or has small elevators</span>
        </label>
      </div>
    </div>
  );
}
