"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export type DraftFormType = "delivery" | "delivery_b2b" | "delivery_dayrate" | "move" | "quote" | "project";

export interface DraftMeta {
  id: string;
  formType: DraftFormType;
  title: string;
  updatedAt: string;
  path: string;
}

interface DraftEntry extends DraftMeta {
  data: Record<string, unknown>;
}

const LS_KEY = "yugo_form_drafts";
const DEBOUNCE_MS = 1500;

const FORM_LABELS: Record<DraftFormType, string> = {
  delivery: "Delivery",
  delivery_b2b: "B2B Delivery",
  delivery_dayrate: "Day-Rate Delivery",
  move: "Move",
  quote: "Quote",
  project: "Project",
};

export function getDraftLabel(type: DraftFormType): string {
  return FORM_LABELS[type] ?? type;
}

export function getDraftCreatePath(type: DraftFormType): string {
  const paths: Record<DraftFormType, string> = {
    delivery: "/admin/deliveries/new",
    delivery_b2b: "/admin/deliveries/new?choice=b2b_oneoff",
    delivery_dayrate: "/admin/deliveries/new?choice=day_rate",
    move: "/admin/moves/new",
    quote: "/admin/quotes/new",
    project: "/admin/projects/new",
  };
  return paths[type] ?? "/admin";
}

function readDrafts(): DraftEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeDrafts(drafts: DraftEntry[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(drafts));
  } catch { /* storage full — silent */ }
}

export function getAllDraftMetas(): DraftMeta[] {
  return readDrafts()
    .map(({ id, formType, title, updatedAt, path }) => ({ id, formType, title, updatedAt, path }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function deleteDraft(id: string) {
  writeDrafts(readDrafts().filter((d) => d.id !== id));
}

export function clearAllDrafts() {
  writeDrafts([]);
}

/**
 * Auto-saves form state to localStorage with debounce, offers restore on mount,
 * and warns before navigating away.
 *
 * @param formType  — which form this is
 * @param formState — current serializable form state (all useState values as an object)
 * @param titleFn   — derives a human-readable draft title from formState (e.g. customer name)
 */
export function useFormDraft<T extends Record<string, unknown>>(
  formType: DraftFormType,
  formState: T,
  titleFn: (state: T) => string,
) {
  const [draftId] = useState(() => {
    if (typeof window === "undefined") return crypto.randomUUID();
    const params = new URLSearchParams(window.location.search);
    return params.get("draftId") || crypto.randomUUID();
  });

  const [hasDraft, setHasDraft] = useState(false);
  const [draftData, setDraftData] = useState<T | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const savedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On mount: check for an existing draft for this form type (from URL param or existing)
  useEffect(() => {
    const drafts = readDrafts();
    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get("draftId");
    const existing = resumeId
      ? drafts.find((d) => d.id === resumeId)
      : drafts.find((d) => d.formType === formType);

    if (existing) {
      setHasDraft(true);
      setDraftData(existing.data as T);
    }
  }, [formType]);

  // Debounced auto-save whenever formState changes
  useEffect(() => {
    if (dismissed && !savedRef.current) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const hasContent = Object.values(formState).some((v) => {
        if (typeof v === "string") return v.trim().length > 0;
        if (typeof v === "number") return v !== 0;
        if (Array.isArray(v)) return v.length > 0;
        return false;
      });
      if (!hasContent) return;

      const drafts = readDrafts().filter((d) => d.id !== draftId);
      drafts.unshift({
        id: draftId,
        formType,
        title: titleFn(formState) || getDraftLabel(formType),
        updatedAt: new Date().toISOString(),
        path: getDraftCreatePath(formType) + `?draftId=${draftId}`,
        data: formState as Record<string, unknown>,
      });
      // Keep max 20 drafts total
      writeDrafts(drafts.slice(0, 20));
      savedRef.current = true;
    }, DEBOUNCE_MS);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [formState, formType, draftId, titleFn, dismissed]);

  // Warn on page close / refresh
  useEffect(() => {
    const hasContent = Object.values(formState).some((v) => {
      if (typeof v === "string") return v.trim().length > 0;
      if (typeof v === "number") return v !== 0;
      if (Array.isArray(v)) return v.length > 0;
      return false;
    });
    if (!hasContent) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [formState]);

  const restoreDraft = useCallback(() => {
    setDismissed(true);
    setHasDraft(false);
    return draftData;
  }, [draftData]);

  const dismissDraft = useCallback(() => {
    setDismissed(true);
    setHasDraft(false);
    setDraftData(null);
    // Remove the old draft for this form type so it doesn't prompt again
    const drafts = readDrafts();
    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get("draftId");
    if (resumeId) {
      writeDrafts(drafts.filter((d) => d.id !== resumeId));
    }
  }, []);

  const clearDraft = useCallback(() => {
    writeDrafts(readDrafts().filter((d) => d.id !== draftId));
    savedRef.current = false;
    setHasDraft(false);
    setDraftData(null);
  }, [draftId]);

  return {
    draftId,
    hasDraft: hasDraft && !dismissed,
    draftData,
    restoreDraft,
    dismissDraft,
    clearDraft,
  };
}
