"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface CollapsibleSectionProps {
  title: string;
  defaultCollapsed?: boolean;
  children: React.ReactNode;
  /** Optional subtitle shown in header when collapsed */
  subtitle?: string;
}

export default function CollapsibleSection({
  title,
  defaultCollapsed = true,
  children,
  subtitle,
}: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className="rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left bg-[var(--card)] border border-[var(--brd)] rounded-xl hover:border-[var(--gold)]/30 transition-colors"
      >
        {collapsed ? (
          <ChevronRight className="w-4 h-4 text-[var(--tx3)] shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-[var(--tx3)] shrink-0" />
        )}
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">{title}</h3>
        {subtitle && collapsed && (
          <span className="text-[11px] text-[var(--tx3)] truncate">— {subtitle}</span>
        )}
      </button>
      {!collapsed && <div className="mt-2">{children}</div>}
    </div>
  );
}
