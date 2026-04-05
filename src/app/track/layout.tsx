import TrackLightTheme from "./TrackLightTheme";

export default function TrackLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TrackLightTheme />
      <div className="min-h-0 w-full max-w-full min-w-0 overflow-x-clip">
        {children}
      </div>
    </>
  );
}
