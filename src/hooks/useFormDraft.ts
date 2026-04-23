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
    move: "/admin-v2/moves/new",
    quote: "/admin-v2/quotes/new",
    project: "/admin/projects/new",
  };
  return paths[type] ?? "/admin";
}

/** Resume link: use `&draftId=` when the base path already has query params. */
export function buildDraftResumePath(formType: DraftFormType, draftId: string): string {
  const base = getDraftCreatePath(formType);
  return base.includes("?") ? `${base}&draftId=${encodeURIComponent(draftId)}` : `${base}?draftId=${encodeURIComponent(draftId)}`;
}

/** Legacy bug: paths like `...?choice=b2b_oneoff?draftId=` broke Next searchParams. */
function normalizeDraftPath(path: string): string {
  const firstQ = path.indexOf("?");
  const bad = path.indexOf("?draftId=");
  if (firstQ >= 0 && bad > firstQ) {
    return `${path.slice(0, bad)}&draftId=${path.slice(bad + "?draftId=".length)}`;
  }
  return path;
}

function readDrafts(): DraftEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed: DraftEntry[] = raw ? JSON.parse(raw) : [];
    let changed = false;
    const fixed = parsed.map((e) => {
      const p = normalizeDraftPath(e.path);
      if (p !== e.path) {
        changed = true;
        return { ...e, path: p };
      }
      return e;
    });
    if (changed) writeDrafts(fixed);
    return fixed;
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
export type UseFormDraftUrlRestore<T extends Record<string, unknown>> = {
  /** If `?draftId=` matches this form session, call `applySaved` once (Resume from Drafts page). */
  applySaved: (data: T) => void;
  /** Debounce before writing localStorage (default 1500ms). */
  debounceMs?: number;
};

export function useFormDraft<T extends Record<string, unknown>>(
  formType: DraftFormType,
  formState: T,
  titleFn: (state: T) => string,
  urlAutoRestore?: UseFormDraftUrlRestore<T>,
) {
  const saveDebounceMs = urlAutoRestore?.debounceMs ?? DEBOUNCE_MS;
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
  const urlRestoreDoneRef = useRef(false);
  const applySavedRef = useRef(urlAutoRestore?.applySaved);
  applySavedRef.current = urlAutoRestore?.applySaved;

  // On mount: resume from URL draftId (auto-apply) or show restore banner for latest draft of this form type
  useEffect(() => {
    if (typeof window === "undefined") return;
    const drafts = readDrafts();
    const params = new URLSearchParams(window.location.search);
    const resumeId = params.get("draftId");
    const existing = resumeId
      ? drafts.find((d) => d.id === resumeId && d.formType === formType)
      : drafts.find((d) => d.formType === formType);

    if (!existing) return;

    const shouldAutoApply =
      Boolean(urlAutoRestore?.applySaved) &&
      Boolean(resumeId) &&
      resumeId === draftId &&
      existing.id === draftId;

    if (shouldAutoApply) {
      if (!urlRestoreDoneRef.current) {
        urlRestoreDoneRef.current = true;
        applySavedRef.current?.(existing.data as T);
        setDismissed(true);
        setHasDraft(false);
        setDraftData(null);
      }
      return;
    }

    setHasDraft(true);
    setDraftData(existing.data as T);
  }, [formType, draftId]);

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
        path: buildDraftResumePath(formType, draftId),
        data: formState as Record<string, unknown>,
      });
      // Keep max 20 drafts total
      writeDrafts(drafts.slice(0, 20));
      savedRef.current = true;
    }, saveDebounceMs);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [formState, formType, draftId, titleFn, dismissed, saveDebounceMs]);

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
