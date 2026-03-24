/** Matches the active-task rules on the crew bin-orders page (drop-off / pickup / overdue). */

export type BinOrderTaskFields = {
  id: string;
  drop_off_date: string;
  pickup_date: string;
  status: string;
  drop_off_completed_at: string | null;
  pickup_completed_at: string | null;
};

export function countActiveBinTasks(orders: BinOrderTaskFields[], today: string, tomorrowStr: string): number {
  const taskKeys = new Set<string>();

  for (const o of orders) {
    if ((o.drop_off_date === today || o.drop_off_date === tomorrowStr) && !o.drop_off_completed_at && o.status !== "cancelled") {
      taskKeys.add(`${o.id}-dropoff`);
    }
    if (
      (o.pickup_date === today || o.pickup_date === tomorrowStr) &&
      o.drop_off_completed_at &&
      !o.pickup_completed_at &&
      o.status !== "cancelled"
    ) {
      taskKeys.add(`${o.id}-pickup`);
    }
  }

  for (const o of orders) {
    if (o.status === "overdue" && !o.pickup_completed_at) {
      const key = `${o.id}-pickup`;
      if (!taskKeys.has(key)) taskKeys.add(key);
    }
  }

  return taskKeys.size;
}
