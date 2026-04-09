'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface DashboardAutoRefreshProps {
  /** Whether there is an in-progress (non-terminal) report to poll for */
  hasActiveReport: boolean;
  /** Interval in milliseconds between refreshes (default: 30 000) */
  intervalMs?: number;
}

/**
 * Invisible client island that keeps the dashboard live while a report is
 * in-flight. Calls router.refresh() on a fixed interval so the server
 * component re-fetches Supabase data without a full page reload.
 */
export default function DashboardAutoRefresh({
  hasActiveReport,
  intervalMs = 30_000,
}: DashboardAutoRefreshProps) {
  const router = useRouter();
  const [secondsAgo, setSecondsAgo] = useState(0);
  const lastRefreshRef = useRef(Date.now());

  // Refresh data on interval
  useEffect(() => {
    if (!hasActiveReport) return;

    const refresh = setInterval(() => {
      router.refresh();
      lastRefreshRef.current = Date.now();
      setSecondsAgo(0);
    }, intervalMs);

    return () => clearInterval(refresh);
  }, [hasActiveReport, intervalMs, router]);

  // Update "X seconds ago" counter every 10 s
  useEffect(() => {
    if (!hasActiveReport) return;

    const tick = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefreshRef.current) / 1000));
    }, 10_000);

    return () => clearInterval(tick);
  }, [hasActiveReport]);

  if (!hasActiveReport) return null;

  const label =
    secondsAgo < 15
      ? 'just now'
      : secondsAgo < 60
      ? `${Math.round(secondsAgo / 10) * 10}s ago`
      : `${Math.floor(secondsAgo / 60)}m ago`;

  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] text-cream/20 select-none">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold/40 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-gold/50" />
      </span>
      Live · updated {label}
    </span>
  );
}
