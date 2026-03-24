export default function CrewLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="skeleton h-8 w-44" />
        <div className="skeleton h-8 w-28 rounded-lg" />
      </div>

      {/* Map placeholder */}
      <div className="skeleton rounded-xl" style={{ height: 400 }} />

      {/* Crew card row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-24 rounded-xl" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    </div>
  );
}
