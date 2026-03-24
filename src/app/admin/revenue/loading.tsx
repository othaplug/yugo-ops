export default function RevenueLoading() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-8 w-36" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>

      {/* Chart */}
      <div className="skeleton h-64 rounded-xl" />

      {/* Secondary chart */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="skeleton h-48 rounded-xl" />
        <div className="skeleton h-48 rounded-xl" style={{ animationDelay: "80ms" }} />
      </div>
    </div>
  );
}
