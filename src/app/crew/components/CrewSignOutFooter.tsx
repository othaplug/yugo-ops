"use client";

/**
 * Sidebar footer: sign out only (no settings panel).
 */
export default function CrewSignOutFooter({ compact = false }: { compact?: boolean }) {
  return (
    <form action="/api/crew/logout" method="POST" className="w-full">
      <button
        type="submit"
        className={
          compact
            ? "crew-keep-round crew-sidebar-rail-item flex w-10 min-h-10 items-center justify-center rounded-xl py-1.5 text-[8px] font-bold uppercase tracking-[0.06em] text-[var(--red)] transition-colors hover:bg-[var(--rdim)] [font-family:var(--font-body)]"
            : "crew-keep-round w-full px-3.5 py-2.5 mx-2 rounded-xl text-left uppercase text-[10px] font-bold tracking-[0.14em] text-[var(--red)] hover:bg-[var(--rdim)] transition-colors [font-family:var(--font-body)]"
        }
        title="Sign out"
        aria-label="Sign out"
      >
        {compact ? "SO" : "Sign out"}
      </button>
    </form>
  );
}
