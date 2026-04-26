/** Whether the crew portal should prompt for a post-job tip report (cash / none / interac). */
export type TipReportTipRow = {
  square_payment_id?: string | null;
  amount?: number | string | null;
  method?: string | null;
  reported_by?: string | null;
};

export const computeCrewTipReportNeeded = (t: TipReportTipRow | null): boolean => {
  if (!t) return true;
  if (t.square_payment_id) return false;
  const amount = Number(t.amount ?? 0);
  const method = String(t.method || "").toLowerCase().trim();
  if (method === "square" && amount > 0) return false;
  if ((method === "cash" || method === "interac") && amount > 0 && t.reported_by) {
    return false;
  }
  if (method === "none" && t.reported_by) return false;
  return true;
};
