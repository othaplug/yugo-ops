import ClaimSubmissionClient from "./ClaimSubmissionClient";

export const metadata = {
  title: "Submit a Claim",
  description: "Report damaged items from your Yugo move.",
};

export default function ClaimNewPage() {
  return (
    <div className="min-h-screen" style={{ background: "#FAF7F2" }}>
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8">
          <span className="text-[20px] font-bold tracking-wide" style={{ color: "#722F37" }}>Yugo+</span>
          <h1 className="text-[28px] font-bold text-[#1a1a1a] mt-3">Submit a Claim</h1>
          <p className="text-[14px] text-[#888] mt-1">Report damaged or missing items from your move.</p>
        </div>
        <ClaimSubmissionClient />
      </div>
    </div>
  );
}
