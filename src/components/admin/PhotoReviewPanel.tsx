'use client';

// ─── Admin Photo Review Panel ─────────────────────────────────────────────────
// Shown in the admin report review step. Displays each photo with its AI
// analysis and lets the admin override: condition rating, defects list,
// professional caption, and comparable adjustment note.
//
// Saves via PATCH /api/admin/reports/[id]/photos

import { useState, useTransition } from 'react';
import type { Photo, PhotoAiAnalysis, PhotoDefect } from '@/types/database';

interface PhotoReviewPanelProps {
  reportId: string;
  photos: Photo[];
}

const CONDITION_OPTIONS = ['excellent', 'good', 'average', 'fair', 'poor'] as const;
const SEVERITY_OPTIONS = ['minor', 'moderate', 'significant'] as const;
const IMPACT_OPTIONS = ['low', 'medium', 'high'] as const;

function getAnalysis(photo: Photo): PhotoAiAnalysis & { admin_override_note?: string; admin_reviewed_at?: string } {
  return (photo.ai_analysis as unknown as PhotoAiAnalysis) ?? {
    condition_rating: 'average',
    defects: [],
    professional_caption: '',
    comparable_adjustment_note: '',
  };
}

export default function PhotoReviewPanel({ reportId, photos }: PhotoReviewPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Partial<PhotoAiAnalysis> & { admin_override_note?: string }>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const analyzedPhotos = photos.filter((p) => p.ai_analysis != null);

  if (analyzedPhotos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 px-6 py-8 text-center text-sm text-gray-400">
        No AI-analyzed photos for this report.
      </div>
    );
  }

  function getEdit(photoId: string): Partial<PhotoAiAnalysis> & { admin_override_note?: string } {
    return edits[photoId] ?? {};
  }

  function setField<K extends keyof (PhotoAiAnalysis & { admin_override_note?: string })>(
    photoId: string,
    field: K,
    value: (PhotoAiAnalysis & { admin_override_note?: string })[K]
  ) {
    setEdits((prev) => ({
      ...prev,
      [photoId]: { ...prev[photoId], [field]: value },
    }));
    setSaved((prev) => ({ ...prev, [photoId]: false }));
  }

  function addDefect(photoId: string, currentDefects: PhotoDefect[]) {
    const newDefect: PhotoDefect = {
      description: '',
      severity: 'moderate',
      value_impact: 'medium',
      location: '',
    };
    setField(photoId, 'defects', [...currentDefects, newDefect]);
  }

  function removeDefect(photoId: string, index: number, currentDefects: PhotoDefect[]) {
    const updated = currentDefects.filter((_, i) => i !== index);
    setField(photoId, 'defects', updated);
  }

  function updateDefect(photoId: string, index: number, field: keyof PhotoDefect, value: string, currentDefects: PhotoDefect[]) {
    const updated = currentDefects.map((d, i) =>
      i === index ? { ...d, [field]: value } : d
    );
    setField(photoId, 'defects', updated);
  }

  async function savePhoto(photo: Photo) {
    const analysis = getAnalysis(photo);
    const edit = getEdit(photo.id);
    const merged = { ...analysis, ...edit };

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/reports/${reportId}/photos`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photo_id: photo.id,
            condition_rating: merged.condition_rating,
            defects: merged.defects,
            professional_caption: merged.professional_caption,
            comparable_adjustment_note: merged.comparable_adjustment_note,
            admin_override_note: (merged as { admin_override_note?: string }).admin_override_note,
          }),
        });
        if (res.ok) {
          setSaved((prev) => ({ ...prev, [photo.id]: true }));
          setErrors((prev) => ({ ...prev, [photo.id]: '' }));
        } else {
          const data = await res.json();
          setErrors((prev) => ({ ...prev, [photo.id]: data.error ?? 'Save failed' }));
        }
      } catch (err) {
        setErrors((prev) => ({ ...prev, [photo.id]: String(err) }));
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">
          AI Photo Analysis Review
          <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
            {analyzedPhotos.length} photo{analyzedPhotos.length !== 1 ? 's' : ''}
          </span>
        </h3>
        <p className="text-xs text-gray-400">Override any field before approving</p>
      </div>

      {analyzedPhotos.map((photo) => {
        const analysis = getAnalysis(photo);
        const edit = getEdit(photo.id);
        const effectiveCondition = edit.condition_rating ?? analysis.condition_rating ?? 'average';
        const effectiveDefects = edit.defects ?? analysis.defects ?? [];
        const effectiveCaption = edit.professional_caption ?? analysis.professional_caption ?? '';
        const effectiveAdjNote = edit.comparable_adjustment_note ?? analysis.comparable_adjustment_note ?? '';
        const isOpen = expanded === photo.id;
        const wasAdminReviewed = !!(analysis as { admin_reviewed_at?: string }).admin_reviewed_at;

        return (
          <div
            key={photo.id}
            className="rounded-lg border border-gray-200 bg-white overflow-hidden"
          >
            {/* Header row */}
            <button
              type="button"
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(isOpen ? null : photo.id)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {(photo.photo_type ?? 'other').replace(/_/g, ' ')}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  effectiveCondition === 'excellent' ? 'bg-emerald-100 text-emerald-700' :
                  effectiveCondition === 'good' ? 'bg-green-100 text-green-700' :
                  effectiveCondition === 'average' ? 'bg-gray-100 text-gray-600' :
                  effectiveCondition === 'fair' ? 'bg-amber-100 text-amber-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {effectiveCondition}
                </span>
                {effectiveDefects.length > 0 && (
                  <span className="text-xs text-gray-400">
                    {effectiveDefects.length} defect{effectiveDefects.length !== 1 ? 's' : ''}
                    {effectiveDefects.filter(d => d.severity === 'significant').length > 0 &&
                      <span className="ml-1 text-red-500">
                        ({effectiveDefects.filter(d => d.severity === 'significant').length} significant)
                      </span>
                    }
                  </span>
                )}
                {wasAdminReviewed && (
                  <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-600">
                    reviewed
                  </span>
                )}
                {saved[photo.id] && (
                  <span className="text-xs text-emerald-600 font-medium">✓ saved</span>
                )}
              </div>
              <svg
                className={`h-4 w-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded editor */}
            {isOpen && (
              <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">

                {/* Condition rating */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Condition Rating</label>
                  <div className="flex gap-2 flex-wrap">
                    {CONDITION_OPTIONS.map((cond) => (
                      <button
                        key={cond}
                        type="button"
                        onClick={() => setField(photo.id, 'condition_rating', cond)}
                        className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                          effectiveCondition === cond
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {cond}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Professional caption */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Professional Caption</label>
                  <textarea
                    rows={2}
                    className="w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none resize-none"
                    value={effectiveCaption}
                    onChange={(e) => setField(photo.id, 'professional_caption', e.target.value)}
                    placeholder="Professional description for the report..."
                  />
                </div>

                {/* Comparable adjustment note */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Comparable Adjustment Note
                    <span className="ml-1 text-gray-400 font-normal">(used in comp grid)</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                    value={effectiveAdjNote}
                    onChange={(e) => setField(photo.id, 'comparable_adjustment_note', e.target.value)}
                    placeholder="e.g. Subject inferior condition — negative adjustment applied"
                  />
                </div>

                {/* Defects */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-600">
                      Defects ({effectiveDefects.length})
                    </label>
                    <button
                      type="button"
                      onClick={() => addDefect(photo.id, effectiveDefects)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      + Add Defect
                    </button>
                  </div>
                  <div className="space-y-2">
                    {effectiveDefects.map((defect, idx) => (
                      <div key={idx} className="rounded border border-gray-100 bg-gray-50 p-3 space-y-2">
                        <div className="flex gap-2">
                          <select
                            className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:outline-none"
                            value={defect.severity}
                            onChange={(e) => updateDefect(photo.id, idx, 'severity', e.target.value, effectiveDefects)}
                          >
                            {SEVERITY_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          <select
                            className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:outline-none"
                            value={defect.value_impact}
                            onChange={(e) => updateDefect(photo.id, idx, 'value_impact', e.target.value, effectiveDefects)}
                          >
                            {IMPACT_OPTIONS.map((i) => <option key={i} value={i}>{i} impact</option>)}
                          </select>
                          <button
                            type="button"
                            onClick={() => removeDefect(photo.id, idx, effectiveDefects)}
                            className="ml-auto text-xs text-red-400 hover:text-red-600"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="text"
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none"
                          value={defect.description}
                          onChange={(e) => updateDefect(photo.id, idx, 'description', e.target.value, effectiveDefects)}
                          placeholder="Defect description..."
                        />
                        <input
                          type="text"
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 focus:outline-none"
                          value={defect.location ?? ''}
                          onChange={(e) => updateDefect(photo.id, idx, 'location', e.target.value, effectiveDefects)}
                          placeholder="Location (e.g. north elevation, kitchen ceiling)..."
                        />
                      </div>
                    ))}
                    {effectiveDefects.length === 0 && (
                      <p className="text-xs text-gray-400 italic">No defects identified by AI. Add manually if needed.</p>
                    )}
                  </div>
                </div>

                {/* Admin note */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Admin Override Note
                    <span className="ml-1 text-gray-400 font-normal">(internal — not in PDF)</span>
                  </label>
                  <input
                    type="text"
                    className="w-full rounded border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none"
                    value={(edit as { admin_override_note?: string }).admin_override_note ?? ''}
                    onChange={(e) => setField(photo.id, 'admin_override_note' as keyof PhotoAiAnalysis, e.target.value as never)}
                    placeholder="Reason for override..."
                  />
                </div>

                {/* Save / error */}
                {errors[photo.id] && (
                  <p className="text-xs text-red-600">{errors[photo.id]}</p>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => savePhoto(photo)}
                    className="rounded bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isPending ? 'Saving…' : 'Save Changes'}
                  </button>
                  {saved[photo.id] && (
                    <span className="text-xs text-emerald-600">Changes saved — will be reflected in final PDF.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
