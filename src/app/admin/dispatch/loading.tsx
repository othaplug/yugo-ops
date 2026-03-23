export default function DispatchLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-52 bg-[var(--brd)]/30 rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-[var(--brd)]/20 rounded-xl" />
        ))}
      </div>
      <div className="min-h-[320px] rounded-xl border border-[var(--brd)]/30 bg-[var(--brd)]/10 p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-[var(--brd)]/20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
