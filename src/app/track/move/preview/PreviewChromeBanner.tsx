export type StandardTrackPreviewVariant =
  | "active"
  | "move-day"
  | "completed"
  | "estate"
  | "estate-walkthrough-done";

const VARIANT_LABEL: Record<StandardTrackPreviewVariant, string> = {
  active: "Sample: standard track before move day (Signature).",
  "move-day": "Sample: standard track on move day (Signature).",
  completed: "Sample: standard track after completion.",
  estate: "Sample: Estate tier track (same layout and chrome as standard).",
  "estate-walkthrough-done":
    "Sample: Estate track with pre-move walkthrough marked complete (timeline styling).",
};

const ESTATE_TRACK_PREVIEW_LINKS: {
  variant: StandardTrackPreviewVariant;
  href: string;
  label: string;
}[] = [
  { variant: "estate", href: "/estate/track-preview", label: "Estate baseline" },
  {
    variant: "estate-walkthrough-done",
    href: "/estate/track-preview/walkthrough-done",
    label: "Walkthrough done",
  },
];

const STANDARD_LINKS: {
  variant: StandardTrackPreviewVariant;
  href: string;
  label: string;
}[] = [
  { variant: "active", href: "/track/move/preview/active", label: "Before complete" },
  {
    variant: "move-day",
    href: "/track/move/preview/move-day",
    label: "Move day",
  },
  {
    variant: "completed",
    href: "/track/move/preview/completed",
    label: "Completed",
  },
];

/** Sticky note that this is not a real tracking link + cross-links between samples. */
export default function PreviewChromeBanner({
  variant,
}: {
  variant: StandardTrackPreviewVariant;
}) {
  return (
    <div
      className="shrink-0 z-60 text-center text-[13px] sm:text-[14px] font-semibold py-2.5 px-3 sm:px-4 border-b leading-snug"
      style={{
        backgroundColor: "rgba(250, 247, 242, 0.98)",
        borderColor: "rgba(44, 62, 45, 0.18)",
        color: "#2C3E2D",
      }}
    >
      <span className="block sm:inline">{VARIANT_LABEL[variant]}</span>
      <span className="hidden sm:inline"> </span>
      <span className="block sm:inline mt-1 sm:mt-0">
        {STANDARD_LINKS.map(({ variant: v, href, label }, i) => (
          <span key={v}>
            {i > 0 ? " · " : ""}
            {v === variant ? (
              <span className="opacity-90">{label}</span>
            ) : (
              <a href={href} className="underline font-bold">
                {label}
              </a>
            )}
          </span>
        ))}
        {" · "}
        <a href="/estate/welcome/preview" className="underline font-bold">
          Estate welcome
        </a>
        {" · "}
        {variant === "estate" || variant === "estate-walkthrough-done" ? (
          ESTATE_TRACK_PREVIEW_LINKS.map(({ variant: ev, href, label }, i) => (
            <span key={ev}>
              {i > 0 ? " · " : ""}
              {ev === variant ? (
                <span className="opacity-90">{label}</span>
              ) : (
                <a href={href} className="underline font-bold">
                  {label}
                </a>
              )}
            </span>
          ))
        ) : (
          <a href="/estate/track-preview" className="underline font-bold">
            Estate track
          </a>
        )}
      </span>
    </div>
  );
}
