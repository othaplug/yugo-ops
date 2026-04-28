/** Single place for "job is finished" checks so tracking cannot regress completed work. */

export const TERMINAL_MOVE_STATUSES = new Set([
  "completed",
  "cancelled",
  "delivered",
  "job_complete",
]);

export const TERMINAL_DELIVERY_STATUSES = new Set([
  "delivered",
  "completed",
  "cancelled",
]);

export const isTerminalMoveStatus = (status: string | null | undefined): boolean => {
  const s = (status || "").toLowerCase().trim();
  return TERMINAL_MOVE_STATUSES.has(s);
};

export const isTerminalDeliveryStatus = (status: string | null | undefined): boolean => {
  const s = (status || "").toLowerCase().trim();
  return TERMINAL_DELIVERY_STATUSES.has(s);
};

export const isTerminalJobStatus = (
  status: string | null | undefined,
  jobType: "move" | "delivery",
): boolean =>
  jobType === "move" ? isTerminalMoveStatus(status) : isTerminalDeliveryStatus(status);
