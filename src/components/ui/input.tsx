import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        className={cn(
          "border-input bg-background file:text-foreground placeholder:text-muted-foreground focus-visible:outline-ring/70 flex h-9 w-full min-w-0 rounded-md border px-3 py-1 text-sm shadow-sm shadow-black/5 transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        type={type}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
