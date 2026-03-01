import { Suspense } from "react";

export const metadata = {
  title: "Sign in | YUGO",
  description: "Sign in to your YUGO operations dashboard",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0D0D0D" }}>Loading…</div>}>{children}</Suspense>;
}
