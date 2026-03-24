export default function QuotesLoading() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-8 w-36" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        {[64, 72, 68].map((w, i) => (
          <div key={i} className="skeleton h-7 rounded-full" style={{ width: w, animationDelay: `${i * 40}ms` }} />
        ))}
      </div>

      <div className="border border-[var(--brd)]/30 rounded-xl overflow-hidden">
        <div className="skeleton h-11 rounded-none" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border-t border-[var(--brd)]/20 px-4 py-3 flex items-center gap-3">
            <div className="skeleton h-4 flex-1 rounded" style={{ animationDelay: `${i * 55}ms` }} />
            <div className="skeleton h-4 w-24 rounded hidden sm:block" style={{ animationDelay: `${i * 55 + 20}ms` }} />
            <div className="skeleton h-5 w-14 rounded-full hidden md:block" style={{ animationDelay: `${i * 55 + 35}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
