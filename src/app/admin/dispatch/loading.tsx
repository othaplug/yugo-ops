export default function DispatchLoading() {
  return (
    <div className="space-y-5">
      <div className="skeleton h-8 w-40" />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-20 rounded-xl" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>

      {/* Dispatch board lanes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[0, 1, 2].map((col) => (
          <div key={col} className="space-y-2.5">
            <div className="skeleton h-7 w-32 rounded-lg" style={{ animationDelay: `${col * 80}ms` }} />
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="skeleton h-[72px] rounded-xl" style={{ animationDelay: `${col * 80 + row * 50}ms` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
