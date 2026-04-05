import { redirect } from "next/navigation";

/** Friendly alias for the Estate sample welcome / move guide (`/estate/welcome/preview`). */
export default function MoveGuidePreviewPage() {
  redirect("/estate/welcome/preview");
}
