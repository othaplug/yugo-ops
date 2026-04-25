export default function PageContent({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full min-w-0 py-4 sm:py-5 md:py-6 animate-fade-up ${className}`.trim()}
    >
      {children}
    </div>
  );
}
