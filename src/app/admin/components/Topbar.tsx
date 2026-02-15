export default function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="border-b border-[var(--brd)] bg-[var(--bg2)] sticky top-0 z-10 backdrop-blur-md">
      <div className="max-w-[1200px] mx-auto px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 md:py-4">
        <h1 className="text-[14px] md:text-[16px] font-semibold text-[var(--tx)]">
          {title}
        </h1>
        {subtitle && (
          <div className="text-[10px] md:text-[11px] text-[var(--tx3)] mt-0.5">{subtitle}</div>
        )}
      </div>
    </div>
  );
}
