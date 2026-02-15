export default function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center px-4 md:px-6 py-3 md:py-4 border-b border-[var(--brd)] bg-[var(--bg2)] sticky top-0 z-10 backdrop-blur-md">
      <div className="min-w-0">
        <h1 className="text-[18px] md:text-[22px] font-semibold text-[var(--tx)] truncate">
          {title}
        </h1>
        {subtitle && (
          <div className="text-[11px] md:text-[12px] text-[var(--tx3)] truncate">{subtitle}</div>
        )}
      </div>
    </div>
  );
}