import ClaimSubmissionClient from "./ClaimSubmissionClient";
import YugoLogo from "@/components/YugoLogo";

export const metadata = {
  title: "Submit a Claim",
  description: "Report damaged items from your Yugo move.",
};

export default function ClaimNewPage() {
  return (
    <div className="min-h-screen" style={{ background: "#F9EDE4" }}>
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        <div className="text-center mb-8">
          <YugoLogo size={26} variant="wine" className="justify-center" />
          <h1 className="text-[28px] font-bold text-[#1a1a1a] mt-3">Submit a Claim</h1>
          <p className="text-[15px] text-[#4F4B47] mt-1">Report damaged or missing items from your move.</p>
        </div>
        <ClaimSubmissionClient />
      </div>
    </div>
  );
}
