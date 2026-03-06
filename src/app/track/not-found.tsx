export default function TrackNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F0F0F] px-4">
      <div className="text-center max-w-md">
        <h1 className="font-heading text-3xl font-bold text-[#E8E5E0] mb-2">Page not found</h1>
        <p className="text-[#B0ADA8] text-[13px] mb-6">
          This move or project can&apos;t be found. The tracking link may be invalid or expired.
        </p>
        <p className="text-[#8A8782] text-[12px]">
          If you need help, please{" "}
          <a
            href={`mailto:${process.env.NEXT_PUBLIC_YUGO_EMAIL || "hello@yugo.com"}`}
            className="text-[#C9A962] hover:underline"
          >
            click here
          </a>{" "}
          to contact us.
        </p>
      </div>
    </div>
  );
}
