export default function QuoteLoading() {
  return (
    <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
      <div className="text-center">
        <div
          className="w-10 h-10 border-2 border-[#B8962E] border-t-transparent rounded-full animate-spin mx-auto mb-4"
          aria-hidden
        />
        <p className="text-[14px] text-[#2C3E2D]/70">Loading your quote…</p>
      </div>
    </div>
  );
}
