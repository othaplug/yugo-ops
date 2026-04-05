import { Suspense } from "react";

export const metadata = {
  title: "Sign In",
  description: "Sign in to your Yugo operations dashboard",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(165deg, #5C1A33 0%, #3e1021 42%, #2a0c18 100%)",
            color: "rgba(255,255,255,0.7)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Loading…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
