export default function TrackLoading() {
  return (
    <div className="min-h-screen bg-[#FAFAF8] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#C9A962] border-t-transparent rounded-full animate-spin" />
        <span className="text-[12px] text-[#888] font-medium">Loading tracking...</span>
      </div>
    </div>
  );
}
