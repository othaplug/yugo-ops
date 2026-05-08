"use client";

import { MagnifyingGlass } from "@phosphor-icons/react";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconProps } from "./Icon";

const field = cva(
  [
    "flex items-center gap-2 rounded-admin-md border bg-admin-card",
    "border-admin-border text-admin-fg",
    "transition-[box-shadow,border-color] duration-[var(--duration-admin-fast)]",
    "focus-within:border-admin-border-focus focus-within:shadow-admin-focus",
    "has-[input:disabled]:opacity-60 has-[input:disabled]:pointer-events-none",
  ],
  {
    variants: {
      size: {
        sm: "h-7 px-2 text-xs",
        md: "h-8 px-2.5 text-sm",
        lg: "h-10 px-3 text-md",
      },
      invalid: {
        true: "border-admin-danger-border focus-within:border-admin-danger-solid focus-within:shadow-admin-focus-danger",
        false: "",
      },
    },
    defaultVariants: { size: "md", invalid: false },
  },
);

type InputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> &
  VariantProps<typeof field> & {
    leading?: IconProps["icon"];
    trailing?: React.ReactNode;
    wrapperClassName?: string;
  };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, wrapperClassName, size, invalid, leading, trailing, type = "text", ...props },
  ref,
) {
  return (
    <label className={cn(field({ size, invalid }), wrapperClassName)}>
      {leading && <Icon icon={leading} size="sm" className="text-admin-fg-tertiary" aria-hidden />}
      <input
        ref={ref}
        type={type}
        className={cn(
          "flex-1 bg-transparent outline-none placeholder:text-admin-fg-quaternary",
          "disabled:cursor-not-allowed",
          className,
        )}
        aria-invalid={invalid || undefined}
        {...props}
      />
      {trailing}
    </label>
  );
});

export const SearchInput = forwardRef<HTMLInputElement, Omit<InputProps, "leading" | "type">>(
  function SearchInput(props, ref) {
    return <Input ref={ref} type="search" leading={MagnifyingGlass} {...props} />;
  },
);
