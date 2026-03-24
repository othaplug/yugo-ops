export default function AdminLoading() {
  return (
    <div className="space-y-5">
      {/* Page title */}
      <div className="skeleton h-8 w-52" />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-[88px] rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-1">
        {/* Activity feed */}
        <div className="lg:col-span-2 space-y-2.5">
          <div className="skeleton h-6 w-32 rounded" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <div className="skeleton w-7 h-7 rounded-full shrink-0" style={{ animationDelay: `${i * 50}ms` }} />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3.5 w-3/4 rounded" style={{ animationDelay: `${i * 50 + 15}ms` }} />
                <div className="skeleton h-3 w-1/3 rounded" style={{ animationDelay: `${i * 50 + 25}ms` }} />
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar widget */}
        <div className="space-y-2.5">
          <div className="skeleton h-6 w-28 rounded" />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-16 rounded-xl" style={{ animationDelay: `${i * 65}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
