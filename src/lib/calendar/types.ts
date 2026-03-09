export type ViewMode = "day" | "week" | "month" | "year";
export type CalendarRole = "admin" | "partner";

export type JobType = "move" | "delivery" | "project_phase";
export type BlockType = JobType | "maintenance" | "training" | "break" | "blocked" | "time_off";

export type CalendarStatus = "scheduled" | "in_progress" | "completed" | "cancelled" | "rescheduled";

export const JOB_COLORS = {
  move: "#C9A962",
  delivery: "#4A9E6B",
  project_phase: "#9B5DE5",
  blocked: "#6B7280",
  maintenance: "#6B7280",
  training: "#64748B",
  break: "#64748B",
  time_off: "#78716C",
} as const;

export const STATUS_DOT_COLORS: Record<string, string> = {
  scheduled: "#3B82F6",
  in_progress: "#F59E0B",
  completed: "#22C55E",
  cancelled: "#D14343",
  rescheduled: "#8B5CF6",
};

export interface CalendarEvent {
  id: string;
  type: JobType | "blocked";
  blockType: BlockType;
  name: string;
  description: string;
  date: string;
  start: string | null;
  end: string | null;
  durationHours: number | null;
  crewId: string | null;
  crewName: string | null;
  truckId: string | null;
  truckName: string | null;
  status: string;
  calendarStatus: CalendarStatus;
  color: string;
  href: string;
  clientName: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  deliveryAddress: string | null;
  category: string | null;
  moveSize: string | null;
  itemCount: number | null;
  scheduleBlockId: string | null;
}

export interface ScheduleBlock {
  id: string;
  crew_id: string;
  block_date: string;
  block_start: string;
  block_end: string;
  block_type: BlockType;
  reference_id: string | null;
  reference_type: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface TimeBlock {
  crew_id: string;
  date: string;
  start: string;
  end: string;
  reference_id?: string;
}

export interface ConflictDetail {
  block_id: string;
  block_type: string;
  start: string;
  end: string;
  reference_type: string;
  reference_label: string;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: ConflictDetail[];
  availableSlots: { start: string; end: string }[];
}

export interface CrewColumn {
  id: string;
  name: string;
  memberCount: number;
  truckName: string | null;
}

export interface YearHeatData {
  [dateKey: string]: { total: number; moves: number; deliveries: number; projects: number };
}

export interface CalendarFilters {
  crewId: string;
  type: string;
  status: string;
}

export const TIME_SLOTS_15MIN: string[] = [];
for (let h = 6; h <= 20; h++) {
  for (let m = 0; m < 60; m += 15) {
    if (h === 20 && m > 0) break;
    TIME_SLOTS_15MIN.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

export function formatTime12(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${mStr} ${ampm}`;
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
