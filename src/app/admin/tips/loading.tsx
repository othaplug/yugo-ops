export default function TipsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-32 bg-[var(--brd)]/30 rounded-lg" />
      <div className="h-24 w-full max-w-2xl bg-[var(--brd)]/15 rounded-xl border border-[var(--brd)]/30" />
      <div className="border border-[var(--brd)]/30 rounded-xl overflow-hidden">
        <div className="h-10 bg-[var(--bg2)]" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-14 border-t border-[var(--brd)]/20" />
        ))}
      </div>
    </div>
  );
}
