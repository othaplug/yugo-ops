export default function ClaimsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-36 bg-[var(--brd)]/30 rounded-lg" />
      <div className="flex flex-wrap gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 flex-1 min-w-[120px] max-w-[180px] bg-[var(--brd)]/20 rounded-xl" />
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
