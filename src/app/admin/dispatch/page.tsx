export const metadata = { title: "Dispatch" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { getTodayString } from "@/lib/business-timezone";
import DispatchBoardClient from "./DispatchBoardClient";

export default function DispatchPage() {
  const today = getTodayString();
  return <DispatchBoardClient today={today} />;
}
