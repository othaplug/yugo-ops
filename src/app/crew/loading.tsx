export default function CrewLoading() {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
        <span className="text-[12px] text-[var(--tx3)] font-medium">Loading...</span>
      </div>
    </div>
  );
}
