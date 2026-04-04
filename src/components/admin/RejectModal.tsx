'use client';

import { useState, useTransition } from 'react';

interface RejectModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (notes: string) => Promise<void>;
  title?: string;
  actionLabel?: string;
  actionColor?: string;
}

export default function RejectModal({
  open,
  onClose,
  onConfirm,
  title = 'Reject Report',
  actionLabel = 'Reject',
  actionColor = 'bg-[#b71c1c] hover:bg-red-800',
}: RejectModalProps) {
  const [notes, setNotes] = useState('');
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  function handleConfirm() {
    if (!notes.trim()) return;
    startTransition(async () => {
      await onConfirm(notes.trim());
      setNotes('');
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-xl bg-white/[0.02] p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-sm text-gray-500">
          Please provide a reason. This will be recorded in the audit trail.
        </p>
        <textarea
          className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744]"
          rows={4}
          placeholder="Enter notes..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={isPending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!notes.trim() || isPending}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white ${actionColor} disabled:opacity-50`}
          >
            {isPending ? 'Submitting...' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
