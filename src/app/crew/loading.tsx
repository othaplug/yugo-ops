export default function CrewLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div className="max-w-lg mx-auto px-4 pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="skeleton h-7 w-36 rounded" />
          <div className="skeleton h-8 w-8 rounded-full" />
        </div>

        {/* Today's job card */}
        <div className="skeleton h-36 rounded-2xl" />

        {/* Job list */}
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
    </div>
  );
}
