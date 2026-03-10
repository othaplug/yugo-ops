import NotFoundActions from "./NotFoundActions";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F0F0F] px-4">
      <div className="text-center max-w-md">
        <h1 className="font-heading text-3xl font-bold text-[#E8E5E0] mb-2">Page not found</h1>
        <p className="text-[#B0ADA8] text-[13px] mb-6">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <NotFoundActions />
      </div>
    </div>
  );
}
