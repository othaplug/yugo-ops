export default function TrackNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAF7F2] px-6 py-12">
      <div className="text-center max-w-xl w-full">
        <h1 className="font-hero text-4xl font-bold text-[#1A1816] mb-3">Page not found</h1>
        <p className="text-[#4F4B47] text-[15px] mb-8 max-w-md mx-auto">
          This move or delivery can&apos;t be found. The tracking link may be invalid or expired.
        </p>
        <p className="text-[#6B6560] text-[12px]">
          If you need help, please{" "}
          <a
            href={`mailto:${process.env.NEXT_PUBLIC_YUGO_EMAIL || "hello@yugo.com"}`}
            className="text-[var(--tx)] hover:underline"
          >
            contact us
          </a>.
        </p>
      </div>
    </div>
  );
}
