export default function ClaimsLoading() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-8 w-28" />

      <div className="flex flex-wrap gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-16 flex-1 min-w-[120px] max-w-[180px] rounded-xl" style={{ animationDelay: `${i * 70}ms` }} />
        ))}
      </div>

      <div className="border border-[var(--brd)]/30 rounded-xl overflow-hidden">
        <div className="skeleton h-11 rounded-none" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border-t border-[var(--brd)]/20 px-4 py-3 flex items-center gap-3">
            <div className="skeleton h-4 flex-1 rounded" style={{ animationDelay: `${i * 55}ms` }} />
            <div className="skeleton h-5 w-16 rounded-full hidden md:block" style={{ animationDelay: `${i * 55 + 30}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
