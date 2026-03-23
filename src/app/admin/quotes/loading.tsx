export default function QuotesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-[var(--brd)]/30 rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-[var(--brd)]/20 rounded-xl" />
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-7 w-20 bg-[var(--brd)]/20 rounded-full" />
        ))}
      </div>
      <div className="border border-[var(--brd)]/30 rounded-xl overflow-hidden">
        <div className="h-10 bg-[var(--bg2)]" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-14 border-t border-[var(--brd)]/20" />
        ))}
      </div>
    </div>
  );
}
