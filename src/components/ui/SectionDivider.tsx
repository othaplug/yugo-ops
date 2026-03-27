import { toSentenceCase } from "@/lib/format-text";

export default function SectionDivider({ label }: { label?: string }) {
  if (!label) return <div className="border-t border-[var(--brd)] my-8" />;
  return (
    <div className="relative my-8">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-[var(--brd)]" />
      </div>
      <div className="relative flex justify-start">
        <span className="bg-[var(--bg)] pr-4 text-[9px] font-bold tracking-[0.18em] text-[var(--tx3)]/60 select-none">
          {toSentenceCase(label)}
        </span>
      </div>
    </div>
  );
}
