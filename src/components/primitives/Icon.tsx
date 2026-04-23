"use client";

import type { Icon as PhosphorIcon, IconWeight } from "@phosphor-icons/react";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<IconSize, number> = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
};

export type IconProps = {
  icon: PhosphorIcon;
  size?: IconSize | number;
  weight?: IconWeight;
  className?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
};

export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { icon: Component, size = "md", weight = "regular", className, ...rest },
  ref,
) {
  const px = typeof size === "number" ? size : SIZE_MAP[size];
  const ariaHidden = rest["aria-label"] ? undefined : true;
  return (
    <Component
      ref={ref}
      size={px}
      weight={weight}
      className={cn("shrink-0", className)}
      aria-hidden={rest["aria-hidden"] ?? ariaHidden}
      aria-label={rest["aria-label"]}
    />
  );
});
