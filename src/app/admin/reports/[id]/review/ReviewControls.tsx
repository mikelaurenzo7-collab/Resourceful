'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ReportNarrative, ReportStatus } from '@/types/database';
import RejectModal from '@/components/admin/RejectModal';
import {
  approveReport,
  rejectReport,
  holdReport,
  editSection,
  regenerateSection,
  rerunPipeline,
} from './actions';

interface ReviewControlsProps {
  reportId: string;
  narratives: ReportNarrative[];
  reportStatus: ReportStatus;
}

export default function ReviewControls({
  reportId,
  narratives,
  reportStatus,
}: ReviewControlsProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [holdOpen, setHoldOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  function handleStartEdit(narrative: ReportNarrative) {
    setEditingId(narrative.id);
    setEditContent(narrative.admin_edited_content ?? narrative.content ?? '');
  }

  function handleCancelEdit() {
    setEditingId(null);
    setEditContent('');
  }

  function handleSaveEdit(sectionId: string) {
    startTransition(async () => {
      try {
        await editSection(reportId, sectionId, editContent);
        setEditingId(null);
        setEditContent('');
        setMessage({ type: 'success', text: 'Section updated successfully.' });
      } catch (err) {
        setMessage({ type: 'error', text: `Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}` });
      }
    });
  }

  function handleRegenerate(sectionKey: string) {
    startTransition(async () => {
      try {
        await regenerateSection(reportId, sectionKey);
        setMessage({ type: 'success', text: `Regenerating section: ${sectionKey}` });
      } catch (err) {
        setMessage({ type: 'error', text: `Failed to regenerate: ${err instanceof Error ? err.message : 'Unknown error'}` });
      }
    });
  }

  function handleApprove() {
    startTransition(async () => {
      try {
        await approveReport(reportId);
        setMessage({ type: 'success', text: 'Report approved and delivered.' });
        router.refresh();
      } catch (err) {
        setMessage({ type: 'error', text: `Failed to approve: ${err instanceof Error ? err.message : 'Unknown error'}` });
      }
    });
  }

  async function handleReject(notes: string) {
    try {
      await rejectReport(reportId, notes);
      setMessage({ type: 'success', text: 'Report rejected.' });
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to reject: ${err instanceof Error ? err.message : 'Unknown error'}` });
    }
  }

  async function handleHold(notes: string) {
    try {
      await holdReport(reportId, notes);
      setMessage({ type: 'success', text: 'Report held for review.' });
      router.refresh();
    } catch (err) {
      setMessage({ type: 'error', text: `Failed to hold: ${err instanceof Error ? err.message : 'Unknown error'}` });
    }
  }

  function handleRerunPipeline() {
    if (!confirm('Are you sure you want to rerun the full pipeline? This will reset all generated content.')) return;
    startTransition(async () => {
      try {
        await rerunPipeline(reportId);
        setMessage({ type: 'success', text: 'Pipeline rerun initiated.' });
        router.refresh();
      } catch (err) {
        setMessage({ type: 'error', text: `Failed to rerun pipeline: ${err instanceof Error ? err.message : 'Unknown error'}` });
      }
    });
  }

  const isActionable = reportStatus === 'pending_approval';

  return (
    <>
      {/* Status message */}
      {message && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-2 font-medium underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Section Review */}
      <section>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Section Review</h2>
        <div className="space-y-3">
          {narratives.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No narrative sections generated yet.</p>
          ) : (
            narratives.map((narrative) => (
              <div
                key={narrative.id}
                className="rounded-xl border border-gray-200 bg-white shadow-sm"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 capitalize">
                      {narrative.section_name.replace(/_/g, ' ')}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {narrative.model_used ?? 'Unknown model'}
                      {narrative.admin_edited && <span className="ml-2 text-amber-600 font-medium">Edited</span>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRegenerate(narrative.section_name)}
                      disabled={isPending}
                      className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Regenerate
                    </button>
                    {editingId === narrative.id ? (
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleSaveEdit(narrative.id)}
                          disabled={isPending}
                          className="rounded-lg bg-[#1a2744] px-3 py-1 text-xs font-medium text-white hover:bg-[#243356] disabled:opacity-50"
                        >
                          {isPending ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(narrative)}
                        className="rounded-lg border border-[#1a2744] px-3 py-1 text-xs font-medium text-[#1a2744] hover:bg-[#1a2744] hover:text-white"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
                <div className="px-4 py-3">
                  {editingId === narrative.id ? (
                    <textarea
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
                      rows={8}
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                    />
                  ) : (
                    <p className="text-sm text-gray-700 line-clamp-2">
                      {narrative.admin_edited_content ?? narrative.content ?? 'No content generated.'}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Decision Buttons */}
      {isActionable && (
        <section>
          <div className="flex items-center gap-4">
            <button
              onClick={handleApprove}
              disabled={isPending}
              className="flex-1 rounded-xl bg-green-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-green-800 disabled:opacity-50"
            >
              {isPending ? 'Processing...' : 'APPROVE AND SEND'}
            </button>
            <button
              onClick={() => setRejectOpen(true)}
              disabled={isPending}
              className="flex-1 rounded-xl bg-[#b71c1c] px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-800 disabled:opacity-50"
            >
              REJECT
            </button>
            <button
              onClick={() => setHoldOpen(true)}
              disabled={isPending}
              className="flex-1 rounded-xl bg-amber-600 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              HOLD FOR REVIEW
            </button>
          </div>
        </section>
      )}

      {/* Rerun Pipeline */}
      <section className="border-t border-gray-200 pt-6">
        <button
          onClick={handleRerunPipeline}
          disabled={isPending}
          className="w-full rounded-xl border-2 border-dashed border-gray-300 px-6 py-3 text-sm font-medium text-gray-600 transition-colors hover:border-[#1a2744] hover:text-[#1a2744] disabled:opacity-50"
        >
          Rerun Full Pipeline
        </button>
      </section>

      {/* Modals */}
      <RejectModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        onConfirm={handleReject}
        title="Reject Report"
        actionLabel="Reject"
        actionColor="bg-[#b71c1c] hover:bg-red-800"
      />
      <RejectModal
        open={holdOpen}
        onClose={() => setHoldOpen(false)}
        onConfirm={handleHold}
        title="Hold for Review"
        actionLabel="Hold"
        actionColor="bg-amber-600 hover:bg-amber-700"
      />
    </>
  );
}
