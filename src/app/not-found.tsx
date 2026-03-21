export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F0F0F] px-6 py-12">
      <div className="text-center max-w-xl w-full">
        <h1 className="font-heading text-4xl font-bold text-[#E8E5E0] mb-3">Page not found</h1>
        <p className="text-[#B0ADA8] text-[15px] max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
    </div>
  );
}
