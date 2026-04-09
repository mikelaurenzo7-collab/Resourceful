'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PipelineActionsProps {
  reportId: string;
  reportStatus: string;
}

export default function PipelineActions({ reportId, reportStatus }: PipelineActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canForceFail = ['paid', 'processing', 'data_pull', 'photo_pending'].includes(reportStatus);
  const canRerun = ['failed', 'rejected', 'pending_approval'].includes(reportStatus);

  async function handleForceFail() {
    if (!confirm('Force-fail this report? It will be marked as failed and the pipeline lock will be released. You can rerun it afterwards.')) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/reports/${reportId}/force-fail`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          setMessage({ type: 'error', text: data.error ?? 'Failed' });
          return;
        }
        setMessage({ type: 'success', text: 'Report force-failed' });
        router.refresh();
      } catch (err) {
        setMessage({ type: 'error', text: `Error: ${err instanceof Error ? err.message : String(err)}` });
      }
    });
  }

  async function handleRerun() {
    if (!confirm('Rerun the full pipeline for this report? This will reset and regenerate all content.')) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/reports/${reportId}/rerun`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          setMessage({ type: 'error', text: data.error ?? 'Failed' });
          return;
        }
        setMessage({ type: 'success', text: 'Pipeline rerun started' });
        router.refresh();
      } catch (err) {
        setMessage({ type: 'error', text: `Error: ${err instanceof Error ? err.message : String(err)}` });
      }
    });
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {message && (
        <span className={`text-xs ${message.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>
          {message.text}
        </span>
      )}

      <Link
        href={`/admin/reports/${reportId}/review`}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-white/[0.06] transition-colors"
      >
        Review
      </Link>

      {canForceFail && (
        <button
          onClick={handleForceFail}
          disabled={isPending}
          className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Working...' : 'Force Fail'}
        </button>
      )}

      {canRerun && (
        <button
          onClick={handleRerun}
          disabled={isPending}
          className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Working...' : 'Rerun'}
        </button>
      )}
    </div>
  );
}
