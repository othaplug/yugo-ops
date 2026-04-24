"use client"

import * as React from "react"
import { cn } from "../lib/cn"
import { MagnifyingGlass, X } from "../icons"

const baseFieldClass = [
  "w-full",
  "bg-[var(--yu3-bg-surface)]",
  "text-[var(--yu3-ink-strong)]",
  "placeholder:text-[var(--yu3-ink-faint)]",
  "border border-[var(--yu3-line)]",
  "rounded-[var(--yu3-r-md)]",
  "px-3 h-9",
  "text-[13px]",
  "transition-colors duration-[var(--yu3-dur-1)]",
  "hover:border-[var(--yu3-line-strong)]",
  "focus:outline-none focus:border-[var(--yu3-wine)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--yu3-wine)_22%,transparent)]",
  "disabled:opacity-50 disabled:cursor-not-allowed",
].join(" ")

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
  invalid?: boolean
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, leadingIcon, trailingIcon, invalid, ...rest }, ref) => {
    if (leadingIcon || trailingIcon) {
      return (
        <label
          className={cn(
            "relative inline-flex items-center w-full",
            invalid && "ring-[var(--yu3-danger)]",
          )}
        >
          {leadingIcon ? (
            <span className="pointer-events-none absolute left-2.5 flex items-center text-[var(--yu3-ink-muted)]">
              {leadingIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            className={cn(
              baseFieldClass,
              leadingIcon && "pl-8",
              trailingIcon && "pr-8",
              invalid && "border-[var(--yu3-danger)] focus:border-[var(--yu3-danger)]",
              className,
            )}
            {...rest}
          />
          {trailingIcon ? (
            <span className="absolute right-2.5 flex items-center text-[var(--yu3-ink-muted)]">
              {trailingIcon}
            </span>
          ) : null}
        </label>
      )
    }
    return (
      <input
        ref={ref}
        className={cn(
          baseFieldClass,
          invalid && "border-[var(--yu3-danger)] focus:border-[var(--yu3-danger)]",
          className,
        )}
        {...rest}
      />
    )
  },
)
Input.displayName = "Input"

export interface SearchInputProps extends InputProps {
  onClear?: () => void
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, onClear, placeholder = "Search…", ...rest }, ref) => {
    const hasValue = typeof value === "string" ? value.length > 0 : false
    return (
      <Input
        ref={ref}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        leadingIcon={<MagnifyingGlass size={14} weight="regular" />}
        trailingIcon={
          hasValue ? (
            <button
              type="button"
              aria-label="Clear"
              onClick={(e) => {
                e.preventDefault()
                onClear?.()
              }}
              className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-[var(--yu3-bg-surface-sunken)] text-[var(--yu3-ink-muted)]"
            >
              <X size={12} weight="regular" />
            </button>
          ) : null
        }
        {...rest}
      />
    )
  },
)
SearchInput.displayName = "SearchInput"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}
export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...rest }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        baseFieldClass,
        "min-h-[88px] py-2 h-auto",
        invalid && "border-[var(--yu3-danger)] focus:border-[var(--yu3-danger)]",
        className,
      )}
      {...rest}
    />
  ),
)
Textarea.displayName = "Textarea"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
}
export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...rest }, ref) => (
    <select
      ref={ref}
      className={cn(
        baseFieldClass,
        "appearance-none pr-7 bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2212%22%20height=%2212%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22currentColor%22%20stroke-width=%222%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22><polyline%20points=%226%209%2012%2015%2018%209%22/></svg>')] bg-no-repeat bg-[right_10px_center]",
        invalid && "border-[var(--yu3-danger)] focus:border-[var(--yu3-danger)]",
        className,
      )}
      {...rest}
    >
      {children}
    </select>
  ),
)
Select.displayName = "Select"
