"use client";

import { useEffect, useRef } from "react";
import type { DraftFormType, DraftMeta } from "./useFormDraft";

/**
 * Mirrors the localStorage draft (useFormDraft) to a server row so an
 * in-progress form survives a cleared cache and resumes on any device. Uses the
 * SAME draftId as the local store, so the ?draftId= resume link resolves against
 * either. Entirely best-effort: any network / missing-table failure is swallowed
 * and the local draft keeps protecting the user.
 */
export function useServerDraftAutosave(opts: {
  draftId: string;
  formType: DraftFormType;
  title: string;
  path: string;
  snapshot: Record<string, unknown>;
  enabled: boolean;
  debounceMs?: number;
}) {
  const { draftId, formType, title, path, snapshot, enabled } = opts;
  const debounceMs = opts.debounceMs ?? 2500;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSentRef = useRef<string>("");

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const serialized = JSON.stringify(snapshot);
    if (serialized === lastSentRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      lastSentRef.current = serialized;
      // No keepalive: a full snapshot can exceed the 64KB keepalive body cap,
      // which would silently drop large inventories. This runs during active
      // editing (not on unload), and the localStorage draft covers the gap.
      fetch("/api/admin/quote-drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: draftId, formType, title, path, snapshot }),
      }).catch(() => {
        // best-effort; local draft is the safety net
        lastSentRef.current = "";
      });
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [draftId, formType, title, path, snapshot, enabled, debounceMs]);
}

/** Fetch this operator's server-side draft metas (for the Drafts list). */
export async function fetchServerDraftMetas(): Promise<DraftMeta[]> {
  try {
    const res = await fetch("/api/admin/quote-drafts", { cache: "no-store" });
    if (!res.ok) return [];
    const body = (await res.json()) as { drafts?: DraftMeta[] };
    return Array.isArray(body.drafts) ? body.drafts : [];
  } catch {
    return [];
  }
}

/** Fetch one server draft's snapshot (cross-device resume). */
export async function fetchServerDraftSnapshot(
  id: string,
): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`/api/admin/quote-drafts/${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { snapshot?: Record<string, unknown> };
    return body.snapshot && typeof body.snapshot === "object"
      ? body.snapshot
      : null;
  } catch {
    return null;
  }
}

/** Remove a server draft (on generate / explicit clear). Best-effort. */
export function deleteServerDraft(id: string): void {
  try {
    fetch(`/api/admin/quote-drafts/${encodeURIComponent(id)}`, {
      method: "DELETE",
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* noop */
  }
}
