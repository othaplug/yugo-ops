export const dynamic = "force-dynamic";

export const metadata = { title: "Schedule" };

import CalendarView from "./CalendarView";

export default function CalendarPage() {
  return (
    <div className="animate-fade-up min-h-0">
      <CalendarView />
    </div>
  );
}
