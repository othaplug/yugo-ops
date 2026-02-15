"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ClientRow({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest("a") && !target.closest("button")) {
          router.push(href);
        }
      }}
      className="hover:bg-[var(--gdim)] transition-colors cursor-pointer group"
    >
      {children}
    </tr>
  );
}
