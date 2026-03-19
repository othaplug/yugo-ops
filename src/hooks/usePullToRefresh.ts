"use client";

import { useEffect, useRef, useState } from "react";

interface Options {
  onRefresh: () => Promise<void> | void;
  /** Distance in px the user must pull before release triggers refresh. Default 72. */
  threshold?: number;
  /** Disable on non-touch devices or when a condition (e.g. loading) is true. */
  disabled?: boolean;
}

/**
 * usePullToRefresh
 * Attaches touch listeners to the provided containerRef and calls `onRefresh`
 * when the user overscrolls downward past the threshold.
 *
 * Returns `pullDistance` (0..threshold) for rendering a visual indicator.
 */
export function usePullToRefresh({ onRefresh, threshold = 72, disabled = false }: Options) {
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startYRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop > 0) return;
      startYRef.current = e.touches[0].clientY;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) { setPullDistance(0); return; }
      if (el.scrollTop > 0) { startYRef.current = null; setPullDistance(0); return; }
      // Apply rubber-band feel: slow down as distance increases
      const clamped = Math.min(dy * 0.45, threshold);
      setPullDistance(clamped);
    };

    const onTouchEnd = async () => {
      if (pullDistance >= threshold * 0.85 && !refreshing) {
        setRefreshing(true);
        setPullDistance(0);
        try {
          await onRefresh();
        } finally {
          setRefreshing(false);
        }
      } else {
        setPullDistance(0);
      }
      startYRef.current = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [disabled, onRefresh, pullDistance, refreshing, threshold]);

  return { containerRef, pullDistance, refreshing };
}
