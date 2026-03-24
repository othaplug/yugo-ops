export default function QuoteLoading() {
  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <div className="max-w-2xl mx-auto px-4 pt-10 space-y-5">
        {/* Logo/header */}
        <div className="flex justify-center mb-6">
          <div className="skeleton h-8 w-28 rounded" />
        </div>

        {/* Quote card */}
        <div className="space-y-4 bg-white rounded-2xl border border-[#E8E4DF] p-6 shadow-sm">
          <div className="skeleton h-6 w-48 rounded" />
          <div className="skeleton h-4 w-3/4 rounded" />

          <div className="grid grid-cols-2 gap-3 pt-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>

          <div className="skeleton h-px w-full rounded" />

          {/* Tier cards */}
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-24 rounded-xl" style={{ animationDelay: `${i * 80}ms` }} />
          ))}
        </div>
      </div>
    </div>
  );
}
