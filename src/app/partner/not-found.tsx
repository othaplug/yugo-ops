export default function PartnerNotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg)] px-4">
      <div className="text-center max-w-md">
        <h1 className="font-hero text-4xl font-bold text-[var(--tx)] mb-2">Page not found</h1>
        <p className="text-[var(--tx2)] text-[13px]">This page doesn&apos;t exist or has been moved.</p>
      </div>
    </div>
  );
}
