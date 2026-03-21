"use client";

/**
 * Internal platform_config / DB key names: only for super-admins, and only in error/help copy.
 * Do not use for normal labels or success states.
 */
export function InternalConfigKeyHint({
  isSuperAdmin,
  configKey,
  className = "mt-1.5 text-[9px] text-[var(--tx3)]",
}: {
  isSuperAdmin: boolean;
  configKey: string;
  className?: string;
}) {
  if (!isSuperAdmin || !configKey) return null;
  return (
    <p className={className}>
      <span className="opacity-80">Technical reference:</span>{" "}
      <code className="rounded bg-[var(--bg)] px-1 py-0.5 text-[10px] font-mono">{configKey}</code>
    </p>
  );
}
