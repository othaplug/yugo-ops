"use client";

import { useState } from "react";

const INITIAL = [
  { label: "Email Notifications", desc: "Receive updates via email", enabled: true },
  { label: "SMS Notifications", desc: "Receive updates via text message", enabled: false },
  { label: "Push Notifications", desc: "Browser push notifications", enabled: true },
];

export default function NotificationToggles() {
  const [items, setItems] = useState(INITIAL);

  const toggle = (i: number) => {
    const next = [...items];
    next[i] = { ...next[i], enabled: !next[i].enabled };
    setItems(next);
  };

  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={item.label} className="flex items-center justify-between py-3 border-b border-[var(--brd)] last:border-0">
          <div>
            <div className="text-[13px] font-semibold text-[var(--tx)]">{item.label}</div>
            <div className="text-[11px] text-[var(--tx3)] mt-0.5">{item.desc}</div>
          </div>
          <button
            onClick={() => toggle(i)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              item.enabled ? "bg-[var(--gold)]" : "bg-[var(--brd)]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                item.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      ))}
    </div>
  );
}
