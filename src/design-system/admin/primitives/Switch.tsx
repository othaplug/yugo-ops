"use client"

import * as React from "react"
import * as S from "@radix-ui/react-switch"
import { cn } from "../lib/cn"

export const Switch = React.forwardRef<
  React.ElementRef<typeof S.Root>,
  React.ComponentPropsWithoutRef<typeof S.Root>
>(({ className, ...rest }, ref) => (
  <S.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-[20px] w-[36px] shrink-0 cursor-pointer items-center",
      "rounded-full border border-transparent",
      "transition-colors duration-[var(--yu3-dur-1)]",
      "bg-[var(--yu3-line-strong)] data-[state=checked]:bg-[var(--yu3-wine)]",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...rest}
  >
    <S.Thumb className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform translate-x-0.5 data-[state=checked]:translate-x-[18px]" />
  </S.Root>
))
Switch.displayName = "Switch"
