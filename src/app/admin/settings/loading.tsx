export default function SettingsLoading() {
  return (
    <div className="space-y-5 max-w-2xl">
      <div className="skeleton h-8 w-36" />

      {/* Tab bar */}
      <div className="flex gap-2 border-b border-[var(--brd)]/30 pb-2">
        {[72, 80, 88, 68].map((w, i) => (
          <div key={i} className="skeleton h-7 rounded" style={{ width: w, animationDelay: `${i * 40}ms` }} />
        ))}
      </div>

      {/* Settings sections */}
      {[0, 1, 2].map((section) => (
        <div key={section} className="space-y-3 p-4 rounded-xl border border-[var(--brd)]/30" style={{ animationDelay: `${section * 80}ms` }}>
          <div className="skeleton h-5 w-40 rounded" />
          {[0, 1, 2].map((row) => (
            <div key={row} className="flex items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="skeleton h-4 w-1/3 rounded" style={{ animationDelay: `${section * 80 + row * 40}ms` }} />
                <div className="skeleton h-3 w-2/3 rounded" style={{ animationDelay: `${section * 80 + row * 40 + 15}ms` }} />
              </div>
              <div className="skeleton h-8 w-24 rounded-lg shrink-0" style={{ animationDelay: `${section * 80 + row * 40 + 25}ms` }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
