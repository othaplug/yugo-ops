export default function ClientsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-40 bg-[var(--brd)]/30 rounded-lg" />
      <div className="h-10 w-full max-w-md bg-[var(--brd)]/20 rounded-lg" />
      <div className="border border-[var(--brd)]/30 rounded-xl overflow-hidden">
        <div className="h-10 bg-[var(--bg2)]" />
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="h-14 border-t border-[var(--brd)]/20" />
        ))}
      </div>
    </div>
  );
}
