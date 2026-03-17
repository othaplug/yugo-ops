"use client";

import { useState, useCallback, useRef, useEffect } from "react";

const STORAGE_PREFIX = "yugo_dt_";

function loadWidths(tableId: string, colIds: string[], defaults: number[]): number[] {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${tableId}_widths`);
    if (raw) {
      const stored: Record<string, number> = JSON.parse(raw);
      return colIds.map((id, i) => Math.max(40, stored[id] ?? defaults[i] ?? 100));
    }
  } catch { /* ignore */ }
  return defaults;
}

function saveWidths(tableId: string, colIds: string[], widths: number[]) {
  try {
    const obj: Record<string, number> = {};
    colIds.forEach((id, i) => { obj[id] = widths[i]; });
    localStorage.setItem(`${STORAGE_PREFIX}${tableId}_widths`, JSON.stringify(obj));
  } catch { /* ignore */ }
}

/**
 * Hook for resizable table columns. Returns widths, a ResizeHandle component, and total width.
 */
export function useColResize(
  tableId: string,
  colIds: string[],
  defaultWidths: number[],
) {
  const [widths, setWidths] = useState<number[]>(() =>
    loadWidths(tableId, colIds, defaultWidths),
  );
  const dragging = useRef<{ col: number; startX: number; startW: number } | null>(null);

  useEffect(() => {
    const loaded = loadWidths(tableId, colIds, defaultWidths);
    setWidths((prev) => (prev.length !== colIds.length ? loaded : prev));
  }, [tableId, colIds.join(",")]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = e.clientX - dragging.current.startX;
      setWidths((prev) => {
        const next = [...prev];
        next[dragging.current!.col] = Math.max(40, dragging.current!.startW + delta);
        return next;
      });
    };
    const onUp = () => {
      if (dragging.current != null) {
        setWidths((prev) => {
          saveWidths(tableId, colIds, prev);
          return prev;
        });
        dragging.current = null;
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [tableId, colIds]);

  const onResizeStart = useCallback((col: number) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = { col, startX: e.clientX, startW: widths[col] };
  }, [widths]);

  const ResizeHandle = useCallback(({ col }: { col: number }) => (
    <span
      onMouseDown={onResizeStart(col)}
      className="absolute right-0 top-0 h-full w-[5px] cursor-col-resize select-none flex items-center justify-center group z-10"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="w-px h-3/4 bg-[var(--brd)] group-hover:bg-[var(--gold)]/60 transition-colors rounded-full" />
    </span>
  ), [onResizeStart]);

  const totalWidth = widths.reduce((a, b) => a + b, 0);

  return { widths, ResizeHandle, totalWidth };
}
