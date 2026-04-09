'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface AccountMenuProps {
  userEmail: string;
  userInitial: string;
}

export default function AccountMenu({ userEmail, userInitial }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full px-2 py-1.5 hover:bg-gold/5 transition-colors focus:outline-none focus:ring-2 focus:ring-gold/40"
        aria-label="Account menu"
        aria-haspopup="true"
        aria-expanded={open}
      >
        <div className="w-8 h-8 rounded-full bg-gold/15 border border-gold/25 flex items-center justify-center">
          <span className="text-sm font-semibold text-gold">{userInitial}</span>
        </div>
        <svg className="w-3.5 h-3.5 text-cream/30 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-64 z-50 animate-scale-in"
          role="menu"
          aria-label="Account options"
        >
          <div className="card-premium rounded-xl p-1 shadow-lg border border-gold/10">
            <div className="px-4 py-3 border-b border-gold/[0.06]">
              <p className="text-sm font-medium text-cream truncate">{userEmail}</p>
              <p className="text-xs text-cream/30 mt-0.5">Personal Account</p>
            </div>
            <div className="py-1">
              <Link
                href="/dashboard"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-cream/60 hover:text-cream hover:bg-gold/5 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Dashboard
              </Link>
              <Link
                href="/start"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-cream/60 hover:text-cream hover:bg-gold/5 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                New Report
              </Link>
            </div>
            <div className="border-t border-gold/[0.06] py-1">
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  role="menuitem"
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/5 rounded-lg transition-colors text-left"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign Out
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
