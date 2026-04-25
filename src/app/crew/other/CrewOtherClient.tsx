"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChartBar,
  Receipt,
  SunHorizon,
  Recycle,
  CaretRight,
} from "@phosphor-icons/react";
import PageContent from "@/app/admin/components/PageContent";
import { cn } from "@/lib/utils";

const rowClass =
  "flex min-h-[52px] items-center justify-between gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--yu3-bg-surface-sunken)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine-tint)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--yu3-bg-canvas)]";

type OtherLink = {
  href: string;
  label: string;
  sub?: string;
  icon: ReactNode;
  match: (path: string) => boolean;
};

const BASE_LINKS: OtherLink[] = [
  {
    href: "/crew/stats",
    label: "Stats",
    sub: "Performance and tips",
    icon: <ChartBar size={22} weight="regular" className="shrink-0 text-[var(--yu3-ink)]" />,
    match: (p) => p.startsWith("/crew/stats"),
  },
  {
    href: "/crew/expense",
    label: "Expense",
    sub: "Submit a receipt",
    icon: <Receipt size={22} weight="regular" className="shrink-0 text-[var(--yu3-ink)]" />,
    match: (p) => p.startsWith("/crew/expense"),
  },
  {
    href: "/crew/end-of-day",
    label: "End of day",
    sub: "Wrap up and submit",
    icon: (
      <SunHorizon size={22} weight="regular" className="shrink-0 text-[var(--yu3-ink)]" />
    ),
    match: (p) => p.startsWith("/crew/end-of-day"),
  },
];

export default function CrewOtherClient() {
  const router = useRouter();
  const pathname = usePathname() || "";
  const [hasActiveBinTasks, setHasActiveBinTasks] = useState(false);

  const load = useCallback(() => {
    fetch("/api/crew/dashboard")
      .then((r) => {
        if (r.status === 401) {
          router.replace("/crew/login");
          return null;
        }
        return r.json();
      })
      .then((d) => {
        if (d && typeof d.hasActiveBinTasks === "boolean") {
          setHasActiveBinTasks(d.hasActiveBinTasks);
        }
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const binLink: OtherLink | null = hasActiveBinTasks
    ? {
        href: "/crew/bin-orders",
        label: "Bin tasks",
        sub: "Active bin work",
        icon: (
          <Recycle size={22} weight="regular" className="shrink-0 text-[var(--yu3-ink)]" />
        ),
        match: (p) => p.startsWith("/crew/bin-orders"),
      }
    : null;

  const links = binLink ? [...BASE_LINKS.slice(0, 2), binLink, BASE_LINKS[2]] : BASE_LINKS;

  return (
    <PageContent className="mx-auto w-full max-w-lg">
      <h1 className="mb-1 text-xl font-semibold text-[var(--yu3-ink)] [font-family:var(--font-body)] sm:text-2xl">
        Other
      </h1>
      <p className="mb-4 text-sm leading-relaxed text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
        Stats, expenses, end of day, and bin work when you have active bin tasks.
      </p>
      <nav
        className="flex flex-col divide-y divide-[var(--yu3-line-subtle)] overflow-hidden rounded-2xl border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)]"
        aria-label="Crew more destinations"
      >
        {links.map((item) => {
          const here = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                rowClass,
                here && "bg-[var(--yu3-wine-tint)]/80",
                here && "text-[var(--yu3-wine)]",
              )}
              aria-current={here ? "page" : undefined}
            >
              <span className="flex min-w-0 items-center gap-3">
                {item.icon}
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[11px] font-bold uppercase tracking-[0.1em] [font-family:var(--font-body)]",
                      here ? "text-[var(--yu3-wine)]" : "text-[var(--yu3-ink)]",
                    )}
                  >
                    {item.label}
                  </span>
                  {item.sub ? (
                    <span className="mt-0.5 block text-[11px] font-normal normal-case leading-snug tracking-normal text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
                      {item.sub}
                    </span>
                  ) : null}
                </span>
              </span>
              <CaretRight
                size={18}
                weight="bold"
                className="shrink-0 text-[var(--yu3-ink-muted)]"
                aria-hidden
              />
            </Link>
          );
        })}
      </nav>
    </PageContent>
  );
}
