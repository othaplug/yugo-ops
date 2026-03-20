"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { GearSix, Moon, SignOut, Sun, User } from "@phosphor-icons/react";
import { useTheme } from "./ThemeContext";

export default function ProfileDropdown({ user }: { user: any }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = user?.email?.split("@")[0]?.slice(0, 2).toUpperCase() || "JO";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="size-8 rounded-full bg-gradient-to-br from-[var(--gold)] to-[#8B7332] flex items-center justify-center text-white text-[9px] font-bold hover:opacity-90 active:opacity-80 transition-opacity touch-manipulation shrink-0"
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[min(220px,calc(100vw-2rem))] max-w-[220px] bg-[var(--bg2)] border border-[var(--brd)] rounded-xl shadow-2xl overflow-hidden z-50 animate-fade-up">
          <div className="px-4 py-3 border-b border-[var(--brd)]">
            <div className="text-[12px] font-semibold text-[var(--tx)] truncate">{user?.email}</div>
            <div className="text-[9px] text-[var(--tx3)]">Administrator</div>
          </div>

          <div className="py-1">
            <Link
              href="/admin/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-[11px] text-[var(--tx2)] hover:bg-[var(--gdim)] hover:text-[var(--tx)] transition-colors"
            >
              <User size={14} className="shrink-0 text-current" aria-hidden />
              Profile Settings
            </Link>

            <Link
              href="/admin/platform"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2.5 text-[11px] text-[var(--tx2)] hover:bg-[var(--gdim)] hover:text-[var(--tx)] transition-colors"
            >
              <GearSix size={14} className="shrink-0 text-current" aria-hidden />
              Platform Settings
            </Link>
          </div>

          <div className="border-t border-[var(--brd)] py-1">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-between w-full px-4 py-2.5 text-[11px] text-[var(--tx2)] hover:bg-[var(--gdim)] hover:text-[var(--tx)] transition-colors"
            >
              <span className="flex items-center gap-2.5">
                {theme === "dark" ? (
                  <Sun size={14} className="shrink-0 text-current" aria-hidden />
                ) : (
                  <Moon size={14} className="shrink-0 text-current" aria-hidden />
                )}
                Appearance
              </span>
              <span className="text-[9px] font-semibold text-[var(--tx3)] bg-[var(--bg)] px-2 py-0.5 rounded-full capitalize">{theme}</span>
            </button>
          </div>

          <div className="border-t border-[var(--brd)]">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 w-full px-4 py-2.5 text-[11px] text-[var(--red)] hover:bg-[var(--rdim)] transition-colors"
            >
              <SignOut size={14} className="shrink-0 text-current" aria-hidden />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}