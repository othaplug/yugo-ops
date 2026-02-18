import type { Project, ProjectVendor } from "./projectsData";

const STORAGE_KEY = "designer-projects-vendor-status";

type SavedState = {
  vendors: ProjectVendor[];
  percent: number;
};

export function getSavedProjectState(projectId: string): SavedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Record<string, SavedState>;
    return data[projectId] ?? null;
  } catch {
    return null;
  }
}

export function saveProjectState(projectId: string, vendors: ProjectVendor[], percent: number): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const data = (raw ? JSON.parse(raw) : {}) as Record<string, SavedState>;
    data[projectId] = { vendors, percent };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

/** Merge saved vendor statuses into project. Saved state overrides initial. */
export function mergeWithSavedState(project: Project): Project {
  const saved = getSavedProjectState(project.id);
  if (!saved || !saved.vendors?.length) return project;
  if (saved.vendors.length !== project.vendors.length) return project;
  const vendors = project.vendors.map((v, i) => ({
    ...v,
    status: saved.vendors[i]?.status ?? v.status,
  }));
  const percent = saved.percent ?? calcPercent(vendors);
  return { ...project, vendors, percent };
}

function calcPercent(vendors: ProjectVendor[]): number {
  if (vendors.length === 0) return 0;
  const done = vendors.filter((v) => v.status === "done").length;
  return Math.round((done / vendors.length) * 100);
}

/** Merge saved state into all projects. Use in client components. */
export function mergeProjectsWithSavedState(projects: Project[]): Project[] {
  return projects.map((p) => mergeWithSavedState(p));
}
