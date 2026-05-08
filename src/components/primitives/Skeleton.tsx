"use client";

import { cn } from "@/lib/cn";

type SkeletonProps = React.HTMLAttributes<HTMLDivElement> & {
  lines?: number;
};

export function Skeleton({ className, lines, ...rest }: SkeletonProps) {
  if (lines && lines > 1) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-3 rounded-admin-sm bg-admin-neutral-bg animate-pulse",
              i === lines - 1 && "w-3/4",
              className,
            )}
            {...rest}
          />
        ))}
      </div>
    );
  }
  return (
    <div
      className={cn("rounded-admin-sm bg-admin-neutral-bg animate-pulse h-4 w-full", className)}
      {...rest}
    />
  );
}
