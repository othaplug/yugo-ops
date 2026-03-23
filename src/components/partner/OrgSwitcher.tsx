"use client";

import { useState, useEffect, useRef } from "react";
import { CaretDown, Buildings, Check } from "@phosphor-icons/react";

interface Org {
  id: string;
  name: string;
  type: string;
}

const STORAGE_KEY = "yugo_selected_org";

export default function OrgSwitcher({ currentOrgId }: { currentOrgId: string }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedId, setSelectedId] = useState(currentOrgId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/partner/organizations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.organizations)) {
          setOrgs(data.organizations);
        }
      })
      .catch(() => {});

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSelectedId(stored);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (orgs.length <= 1) return null;

  const current = orgs.find((o) => o.id === selectedId) ?? orgs[0];

  const handleSwitch = (orgId: string) => {
    setSelectedId(orgId);
    localStorage.setItem(STORAGE_KEY, orgId);
    setOpen(false);
    window.location.reload();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg border border-[var(--brd)] bg-[var(--bg2)] px-3 py-1.5 text-sm text-[var(--tx1)] transition-colors hover:bg-[var(--bg3)]"
      >
        <Buildings size={16} className="text-[var(--tx3)]" />
        <span className="max-w-[160px] truncate">{current?.name ?? "Organization"}</span>
        <CaretDown
          size={14}
          className={`text-[var(--tx3)] transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-lg border border-[var(--brd)] bg-[var(--bg1)] py-1 shadow-lg">
          {orgs.map((org) => (
            <button
              key={org.id}
              type="button"
              onClick={() => handleSwitch(org.id)}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--bg2)]"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate font-medium text-[var(--tx1)]">{org.name}</p>
                <p className="text-xs text-[var(--tx3)] capitalize">{org.type}</p>
              </div>
              {org.id === selectedId && (
                <Check size={16} weight="bold" className="text-[var(--grn)] flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
