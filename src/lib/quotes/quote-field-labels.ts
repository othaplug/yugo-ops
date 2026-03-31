import { isClientLogisticsDeliveryServiceType } from "@/lib/quotes/b2b-quote-copy";

/** Admin / coordinator form: primary service date label by quote service type. */
export function quoteFormServiceDateLabel(serviceType: string): string {
  if (serviceType === "labour_only") return "Date *";
  if (serviceType === "bin_rental") return "Bin Move Date *";
  if (isClientLogisticsDeliveryServiceType(serviceType)) {
    return "Delivery Date *";
  }
  if (serviceType === "office_move") return "Relocation Date *";
  return "Move Date *";
}

/** Read-only quote detail / table column label (no asterisk). */
export function quoteDetailDateLabel(serviceType: string): string {
  if (serviceType === "labour_only") return "Date";
  if (serviceType === "bin_rental") return "Bin Move Date";
  if (isClientLogisticsDeliveryServiceType(serviceType)) {
    return "Delivery Date";
  }
  if (serviceType === "office_move") return "Relocation Date";
  return "Move Date";
}

/** Section card title on admin new-quote form. */
export function quoteFormSchedulingSectionTitle(serviceType: string): string {
  if (serviceType === "labour_only") return "Scheduling";
  if (serviceType === "bin_rental") return "Move Date & Rental Cycle";
  if (isClientLogisticsDeliveryServiceType(serviceType)) return "Delivery Details";
  return "Move Details";
}
