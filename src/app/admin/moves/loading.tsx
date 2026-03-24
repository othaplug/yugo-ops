export default function MovesLoading() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="skeleton h-8 w-40" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap pt-1">
        {[80, 72, 64, 88, 68].map((w, i) => (
          <div key={i} className="skeleton h-7 rounded-full" style={{ width: w, animationDelay: `${i * 40}ms` }} />
        ))}
      </div>

      {/* Search bar */}
      <div className="skeleton h-9 w-full max-w-sm rounded-lg" />

      {/* Table */}
      <div className="border border-[var(--brd)]/30 rounded-xl overflow-hidden">
        <div className="skeleton h-11 rounded-none" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="border-t border-[var(--brd)]/20 px-4 py-3 flex items-center gap-3">
            <div className="skeleton h-4 w-4 rounded-full shrink-0" style={{ animationDelay: `${i * 50}ms` }} />
            <div className="skeleton h-4 flex-1 rounded" style={{ animationDelay: `${i * 50 + 20}ms` }} />
            <div className="skeleton h-4 w-20 rounded hidden sm:block" style={{ animationDelay: `${i * 50 + 30}ms` }} />
            <div className="skeleton h-5 w-16 rounded-full hidden md:block" style={{ animationDelay: `${i * 50 + 40}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
