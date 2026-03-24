export default function ReportsLoading() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-8 w-36" />

      {/* Tab bar */}
      <div className="flex gap-2">
        {[72, 80, 88, 76].map((w, i) => (
          <div key={i} className="skeleton h-8 rounded-lg" style={{ width: w, animationDelay: `${i * 45}ms` }} />
        ))}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>

      {/* Chart blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="skeleton h-52 rounded-xl" />
        <div className="skeleton h-52 rounded-xl" style={{ animationDelay: "80ms" }} />
      </div>

      {/* Table */}
      <div className="border border-[var(--brd)]/30 rounded-xl overflow-hidden">
        <div className="skeleton h-11 rounded-none" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="border-t border-[var(--brd)]/20 px-4 py-3 flex items-center gap-3">
            <div className="skeleton h-4 flex-1 rounded" style={{ animationDelay: `${i * 55}ms` }} />
            <div className="skeleton h-4 w-20 rounded hidden sm:block" style={{ animationDelay: `${i * 55 + 25}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
