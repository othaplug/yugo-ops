export default function PayLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#FAF8F5] to-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#C9A962] border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] text-[#888] font-medium">Loading payment...</p>
      </div>
    </div>
  );
}
