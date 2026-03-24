export default function PartnerLoading() {
  return (
    <div className="min-h-screen bg-[#FAF8F5]">
      <div className="max-w-4xl mx-auto px-4 pt-8 space-y-5">
        {/* Header bar */}
        <div className="flex items-center justify-between">
          <div className="skeleton h-8 w-40 rounded-lg" />
          <div className="skeleton h-8 w-24 rounded-full" />
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 border-b border-[#E8E4DF] pb-2">
          {[64, 72, 80, 68].map((w, i) => (
            <div key={i} className="skeleton h-7 rounded" style={{ width: w, animationDelay: `${i * 40}ms` }} />
          ))}
        </div>

        {/* Content rows */}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 rounded-xl" style={{ animationDelay: `${i * 70}ms` }} />
        ))}
      </div>
    </div>
  );
}
