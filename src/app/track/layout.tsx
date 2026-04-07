import TrackLightTheme from "./TrackLightTheme";
import { YugoBetaBanner } from "@/components/YugoBetaBanner";

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TrackLightTheme />
      <div className="min-h-0 w-full max-w-full min-w-0 overflow-x-clip flex flex-col">
        <YugoBetaBanner />
        {children}
      </div>
    </>
  );
}
