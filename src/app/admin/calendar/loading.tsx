export default function CalendarLoading() {
  return (
    <div className="space-y-4">
      {/* Header: title + nav */}
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-44" />
        <div className="flex gap-2">
          <div className="skeleton h-8 w-8 rounded-lg" />
          <div className="skeleton h-8 w-28 rounded-lg" />
          <div className="skeleton h-8 w-8 rounded-lg" />
        </div>
      </div>

      {/* View toggle tabs */}
      <div className="flex gap-1.5">
        {[56, 52, 64].map((w, i) => (
          <div key={i} className="skeleton h-8 rounded-lg" style={{ width: w, animationDelay: `${i * 50}ms` }} />
        ))}
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="skeleton h-7 rounded" style={{ animationDelay: `${i * 35}ms` }} />
        ))}
      </div>

      {/* Calendar grid — 5 rows × 7 cols */}
      {[0, 1, 2, 3, 4].map((row) => (
        <div key={row} className="grid grid-cols-7 gap-1">
          {[0, 1, 2, 3, 4, 5, 6].map((col) => (
            <div
              key={col}
              className="skeleton rounded-lg"
              style={{ height: 72, animationDelay: `${(row * 7 + col) * 20}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
