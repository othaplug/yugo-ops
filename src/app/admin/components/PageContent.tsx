export default function PageContent({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up ${className}`}
    >
      {children}
    </div>
  );
}
