"use client";
import SectionError from "@/components/admin/SectionError";
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <SectionError error={error} reset={reset} section="Projects" />;
}
