export default function PartnersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-44 bg-[var(--brd)]/30 rounded-lg" />
      <div className="h-10 w-full max-w-md bg-[var(--brd)]/20 rounded-lg" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-36 bg-[var(--brd)]/20 rounded-xl border border-[var(--brd)]/30" />
        ))}
      </div>
    </div>
  );
}
