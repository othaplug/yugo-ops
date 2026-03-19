export default function MovesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[var(--brd)]/30 rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-[var(--brd)]/20 rounded-xl" />
        ))}
      </div>
      <div className="border-t border-[var(--brd)]/30 pt-5">
        <div className="flex gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-7 w-20 bg-[var(--brd)]/20 rounded-full" />
          ))}
        </div>
        <div className="h-10 w-full max-w-md bg-[var(--brd)]/20 rounded-lg mb-4" />
        <div className="border border-[var(--brd)]/30 rounded-xl overflow-hidden">
          <div className="h-12 bg-[var(--bg2)] flex items-center justify-center">
            <span className="text-[11px] font-semibold text-[var(--tx3)]">Loading moves…</span>
          </div>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="h-14 border-t border-[var(--brd)]/20" />
          ))}
        </div>
      </div>
    </div>
  );
}
