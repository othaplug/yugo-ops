"use client";

import { cn } from "@/lib/cn";
import { Icon, type IconProps } from "./Icon";

type EmptyStateProps = {
  icon?: IconProps["icon"];
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  compact?: boolean;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-6 gap-1.5" : "py-12 gap-2",
        className,
      )}
    >
      {icon && (
        <div className="flex h-10 w-10 items-center justify-center rounded-admin-full bg-admin-accent-subtle text-admin-accent">
          <Icon icon={icon} size="lg" aria-hidden />
        </div>
      )}
      <div className="mt-1 text-sm font-medium text-admin-fg">{title}</div>
      {description && (
        <div className="max-w-sm text-xs text-admin-fg-tertiary">{description}</div>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
