import Link from "next/link";

export default function TrackNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F0F0F] px-4">
      <div className="text-center max-w-md">
        <h1 className="font-heading text-3xl font-bold text-[#E8E5E0] mb-2">Page not found</h1>
        <p className="text-[#B0ADA8] text-[13px] mb-6">
          This move or delivery can&apos;t be found. The tracking link may be invalid or expired.
        </p>
        <div className="flex flex-wrap justify-center gap-3 mb-6">
          <Link
            href="/tracking"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-semibold bg-[#C9A962] text-[#0D0D0D] hover:bg-[#D4B56C] transition-all"
          >
            ← Go Home
          </Link>
          <a
            href={`mailto:${process.env.NEXT_PUBLIC_YUGO_EMAIL || "hello@yugo.com"}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-[12px] font-semibold border border-[#2A2A2A] text-[#B0ADA8] hover:border-[#C9A962] hover:text-[#E8E5E0] transition-all"
          >
            Contact Us
          </a>
        </div>
        <p className="text-[#8A8782] text-[12px]">
          If you need help, please{" "}
          <a
            href={`mailto:${process.env.NEXT_PUBLIC_YUGO_EMAIL || "hello@yugo.com"}`}
            className="text-[#C9A962] hover:underline"
          >
            contact us
          </a>.
        </p>
      </div>
    </div>
  );
}
