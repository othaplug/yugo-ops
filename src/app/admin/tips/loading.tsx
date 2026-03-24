export default function TipsLoading() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-8 w-24" />
      <div className="skeleton h-24 w-full max-w-2xl rounded-xl" />

      <div className="border border-[var(--brd)]/30 rounded-xl overflow-hidden">
        <div className="skeleton h-11 rounded-none" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="border-t border-[var(--brd)]/20 px-4 py-3 flex items-center gap-3">
            <div className="skeleton h-4 flex-1 rounded" style={{ animationDelay: `${i * 55}ms` }} />
            <div className="skeleton h-4 w-16 rounded hidden sm:block" style={{ animationDelay: `${i * 55 + 25}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
