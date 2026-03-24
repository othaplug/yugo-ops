export default function ClientsLoading() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-8 w-32" />
      <div className="skeleton h-9 w-full max-w-sm rounded-lg" />

      <div className="border border-[var(--brd)]/30 rounded-xl overflow-hidden">
        <div className="skeleton h-11 rounded-none" />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="border-t border-[var(--brd)]/20 px-4 py-3 flex items-center gap-3">
            <div className="skeleton w-8 h-8 rounded-full shrink-0" style={{ animationDelay: `${i * 45}ms` }} />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-3.5 w-2/5 rounded" style={{ animationDelay: `${i * 45 + 15}ms` }} />
              <div className="skeleton h-3 w-1/3 rounded" style={{ animationDelay: `${i * 45 + 25}ms` }} />
            </div>
            <div className="skeleton h-5 w-16 rounded-full hidden sm:block" style={{ animationDelay: `${i * 45 + 35}ms` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
