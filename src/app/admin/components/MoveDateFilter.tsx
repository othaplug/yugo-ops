"use client";

import { MOVE_DATE_OPTIONS, getDateRangeFromPreset } from "@/lib/date-presets";

interface MoveDateFilterProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  label?: string;
}

export default function MoveDateFilter({ value, onChange, className = "", label = "Move date" }: MoveDateFilterProps) {
  const groups = Array.from(new Set(MOVE_DATE_OPTIONS.map((o) => o.group).filter(Boolean)));

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-[10px] font-medium text-[var(--tx3)] shrink-0">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-[11px] bg-[var(--card)] border border-[var(--brd)] rounded-md px-2.5 py-1.5 text-[var(--tx)] focus:border-[var(--gold)] outline-none min-w-[120px] min-h-[36px]"
      >
        <option value="">All dates</option>
        {groups.map((group) => (
          <optgroup key={group} label={group}>
            {MOVE_DATE_OPTIONS.filter((o) => o.group === group).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

export { getDateRangeFromPreset };
