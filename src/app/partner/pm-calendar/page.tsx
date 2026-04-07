import { redirect } from "next/navigation";

/** Bookmarkable entry to the PM portal Calendar tab (requires PM partner + sign-in). */
export default function PartnerPmCalendarShortcutPage() {
  redirect("/partner?pmTab=calendar");
}
