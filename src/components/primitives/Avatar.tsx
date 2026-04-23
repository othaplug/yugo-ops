"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, useState } from "react";
import { cn } from "@/lib/cn";

const avatar = cva(
  [
    "relative inline-flex items-center justify-center shrink-0 overflow-hidden",
    "bg-admin-neutral-bg text-admin-neutral-fg font-medium select-none",
    "rounded-admin-full",
  ],
  {
    variants: {
      size: {
        xs: "h-5 w-5 text-[10px]",
        sm: "h-6 w-6 text-[11px]",
        md: "h-8 w-8 text-xs",
        lg: "h-10 w-10 text-sm",
        xl: "h-12 w-12 text-md",
      },
    },
    defaultVariants: { size: "md" },
  },
);

export function initials(name: string | undefined | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

type AvatarProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof avatar> & {
    src?: string | null;
    name?: string | null;
    alt?: string;
  };

export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { className, size, src, name, alt, ...rest },
  ref,
) {
  const [errored, setErrored] = useState(false);
  const showImg = src && !errored;
  return (
    <span ref={ref} className={cn(avatar({ size }), className)} {...rest}>
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? name ?? ""}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        <span aria-hidden>{initials(name)}</span>
      )}
    </span>
  );
});

type AvatarStackProps = {
  items: Array<{ src?: string | null; name?: string | null; id?: string }>;
  max?: number;
  size?: VariantProps<typeof avatar>["size"];
  className?: string;
};

export function AvatarStack({ items, max = 4, size = "sm", className }: AvatarStackProps) {
  const visible = items.slice(0, max);
  const overflow = items.length - visible.length;
  return (
    <span className={cn("inline-flex -space-x-1.5", className)}>
      {visible.map((it, i) => (
        <Avatar
          key={it.id ?? i}
          src={it.src ?? undefined}
          name={it.name ?? undefined}
          size={size}
          className="ring-2 ring-admin-card"
        />
      ))}
      {overflow > 0 && (
        <span
          className={cn(
            avatar({ size }),
            "ring-2 ring-admin-card bg-admin-neutral-bg text-admin-neutral-fg",
          )}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
