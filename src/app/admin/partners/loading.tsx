export default function PartnersLoading() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-8 w-36" />
      <div className="skeleton h-9 w-full max-w-sm rounded-lg" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-36 rounded-xl border border-[var(--brd)]/20" style={{ animationDelay: `${i * 55}ms` }} />
        ))}
      </div>
    </div>
  );
}
