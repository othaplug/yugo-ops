import { Suspense } from "react";

export const metadata = {
  title: "Sign in | OPS+",
  description: "Sign in to your OPS+ operations dashboard",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Suspense fallback={<div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0D0D0D" }}>Loading…</div>}>{children}</Suspense>;
}
