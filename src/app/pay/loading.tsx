export default function PayLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FAF8F5] to-white flex items-start justify-center pt-12 px-4">
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <div className="skeleton h-7 w-40 rounded mx-auto" />
          <div className="skeleton h-4 w-56 rounded mx-auto" />
        </div>

        {/* Summary card */}
        <div className="bg-white rounded-2xl border border-[#E8E4DF] p-5 space-y-3 shadow-sm">
          <div className="skeleton h-5 w-32 rounded" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex justify-between items-center">
              <div className="skeleton h-4 w-28 rounded" style={{ animationDelay: `${i * 50}ms` }} />
              <div className="skeleton h-4 w-16 rounded" style={{ animationDelay: `${i * 50 + 20}ms` }} />
            </div>
          ))}
          <div className="skeleton h-px w-full rounded" />
          <div className="flex justify-between items-center">
            <div className="skeleton h-5 w-16 rounded" />
            <div className="skeleton h-6 w-20 rounded" />
          </div>
        </div>

        {/* Payment form area */}
        <div className="bg-white rounded-2xl border border-[#E8E4DF] p-5 space-y-3 shadow-sm">
          <div className="skeleton h-5 w-32 rounded" />
          <div className="skeleton h-12 rounded-xl" />
          <div className="skeleton h-12 rounded-xl" style={{ animationDelay: "60ms" }} />
          <div className="skeleton h-12 rounded-xl bg-[rgba(201,169,98,0.15)]" style={{ animationDelay: "120ms" }} />
        </div>
      </div>
    </div>
  );
}
