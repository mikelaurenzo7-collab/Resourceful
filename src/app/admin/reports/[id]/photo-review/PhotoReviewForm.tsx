'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Photo, PhotoAiAnalysis, PhotoDefect, ReportStatus } from '@/types/database';
import { submitPhotoAnnotations, completePhotoReviewAndResume } from './actions';

interface PhotoWithUrl extends Photo {
  signedUrl: string | null;
}

interface PhotoReviewFormProps {
  reportId: string;
  photos: PhotoWithUrl[];
  reportStatus: ReportStatus;
}

type ConditionRating = PhotoAiAnalysis['condition_rating'];
type DefectDraft = {
  type: string;
  description: string;
  severity: PhotoDefect['severity'];
  value_impact: PhotoDefect['value_impact'];
  report_language: string;
};

const EMPTY_DEFECT: DefectDraft = {
  type: '',
  description: '',
  severity: 'minor',
  value_impact: 'low',
  report_language: '',
};

const CONDITION_OPTIONS: { value: ConditionRating; label: string; color: string }[] = [
  { value: 'poor', label: 'Poor', color: 'bg-red-100 text-red-800 border-red-300' },
  { value: 'fair', label: 'Fair', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { value: 'average', label: 'Average', color: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  { value: 'good', label: 'Good', color: 'bg-blue-100 text-blue-800 border-blue-300' },
  { value: 'excellent', label: 'Excellent', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
];

const COMMON_DEFECT_TYPES = [
  'Roof damage', 'Foundation crack', 'Peeling paint', 'Rotting wood',
  'Siding damage', 'Window deterioration', 'Drainage issue', 'Grading problem',
  'HVAC visible issue', 'Structural concern', 'Deferred maintenance',
  'Functional obsolescence', 'External obsolescence', 'Age-related wear',
];

interface PhotoAnnotationState {
  condition_rating: ConditionRating;
  defects: DefectDraft[];
  inferred_direction: string;
  professional_caption: string;
  comparable_adjustment_note: string;
}

export default function PhotoReviewForm({
  reportId,
  photos,
  reportStatus,
}: PhotoReviewFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  // Initialize annotation state from existing ai_analysis (if re-reviewing) or empty
  const [annotations, setAnnotations] = useState<Record<string, PhotoAnnotationState>>(() => {
    const initial: Record<string, PhotoAnnotationState> = {};
    for (const photo of photos) {
      const existing = photo.ai_analysis as unknown as PhotoAiAnalysis | null;
      initial[photo.id] = existing
        ? {
            condition_rating: existing.condition_rating,
            defects: existing.defects.map((d) => ({ ...d })),
            inferred_direction: existing.inferred_direction,
            professional_caption: existing.professional_caption,
            comparable_adjustment_note: existing.comparable_adjustment_note,
          }
        : {
            condition_rating: 'average',
            defects: [],
            inferred_direction: '',
            professional_caption: '',
            comparable_adjustment_note: '',
          };
    }
    return initial;
  });

  const activePhoto = photos[activePhotoIndex];
  const activeAnnotation = annotations[activePhoto.id];

  function updateAnnotation(photoId: string, updates: Partial<PhotoAnnotationState>) {
    setAnnotations((prev) => ({
      ...prev,
      [photoId]: { ...prev[photoId], ...updates },
    }));
  }

  function addDefect(photoId: string) {
    setAnnotations((prev) => ({
      ...prev,
      [photoId]: {
        ...prev[photoId],
        defects: [...prev[photoId].defects, { ...EMPTY_DEFECT }],
      },
    }));
  }

  function updateDefect(photoId: string, index: number, updates: Partial<DefectDraft>) {
    setAnnotations((prev) => {
      const defects = [...prev[photoId].defects];
      defects[index] = { ...defects[index], ...updates };
      return { ...prev, [photoId]: { ...prev[photoId], defects } };
    });
  }

  function removeDefect(photoId: string, index: number) {
    setAnnotations((prev) => {
      const defects = prev[photoId].defects.filter((_, i) => i !== index);
      return { ...prev, [photoId]: { ...prev[photoId], defects } };
    });
  }

  function isPhotoComplete(photoId: string): boolean {
    const a = annotations[photoId];
    return (
      a.inferred_direction.length > 0 &&
      a.professional_caption.length > 0
    );
  }

  const completedCount = photos.filter((p) => isPhotoComplete(p.id)).length;
  const allComplete = completedCount === photos.length;

  function handleSaveAnnotations() {
    startTransition(async () => {
      try {
        const payload = {
          annotations: photos.map((photo) => ({
            photo_id: photo.id,
            ...annotations[photo.id],
          })),
        };
        await submitPhotoAnnotations(reportId, payload);
        setMessage({ type: 'success', text: `Saved annotations for ${photos.length} photos.` });
      } catch (err) {
        setMessage({
          type: 'error',
          text: `Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
    });
  }

  function handleCompleteAndResume() {
    if (!allComplete) {
      setMessage({ type: 'error', text: 'All photos must have a direction and caption before resuming.' });
      return;
    }
    if (!confirm('Complete photo review and resume pipeline? This will save your annotations and continue report generation.')) {
      return;
    }
    startTransition(async () => {
      try {
        // Save annotations first
        const payload = {
          annotations: photos.map((photo) => ({
            photo_id: photo.id,
            ...annotations[photo.id],
          })),
        };
        await submitPhotoAnnotations(reportId, payload);
        // Then resume pipeline
        await completePhotoReviewAndResume(reportId);
        setMessage({ type: 'success', text: 'Photo review complete. Pipeline resuming — condition adjustments will be applied.' });
        router.refresh();
      } catch (err) {
        setMessage({
          type: 'error',
          text: `Failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
      }
    });
  }

  const isReviewable = reportStatus === 'photo_review';

  return (
    <div className="mx-6 my-6">
      {/* Status message */}
      {message && (
        <div
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-2 font-medium underline">
            Dismiss
          </button>
        </div>
      )}

      <div className="flex gap-6">
        {/* Photo thumbnails sidebar */}
        <div className="w-24 flex-shrink-0 space-y-2">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              onClick={() => setActivePhotoIndex(i)}
              className={`relative w-full rounded-lg border-2 overflow-hidden transition-all ${
                i === activePhotoIndex
                  ? 'border-[#1a2744] ring-2 ring-[#1a2744]/30'
                  : isPhotoComplete(photo.id)
                  ? 'border-green-400'
                  : 'border-gray-200 hover:border-gray-400'
              }`}
            >
              {photo.signedUrl ? (
                <img
                  src={photo.signedUrl}
                  alt={photo.photo_type ?? `Photo ${i + 1}`}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="aspect-square w-full bg-gray-100 flex items-center justify-center">
                  <span className="text-xs text-gray-400">{i + 1}</span>
                </div>
              )}
              {isPhotoComplete(photo.id) && (
                <div className="absolute top-1 right-1 rounded-full bg-green-500 p-0.5">
                  <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                <span className="text-[10px] text-white truncate block">
                  {photo.photo_type?.replace(/_/g, ' ') ?? `#${i + 1}`}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Main review area */}
        <div className="flex-1 flex gap-6">
          {/* Photo display */}
          <div className="w-1/2">
            <div className="sticky top-6">
              {activePhoto.signedUrl ? (
                <img
                  src={activePhoto.signedUrl}
                  alt={activePhoto.photo_type ?? 'Property photo'}
                  className="w-full rounded-xl border border-gray-200 shadow-sm"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-white">
                  <p className="text-sm text-gray-500">Photo not available</p>
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span className="capitalize">{activePhoto.photo_type?.replace(/_/g, ' ') ?? 'Unknown type'}</span>
                <span>Photo {activePhotoIndex + 1} of {photos.length}</span>
              </div>

              {/* Navigation */}
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setActivePhotoIndex(Math.max(0, activePhotoIndex - 1))}
                  disabled={activePhotoIndex === 0}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  onClick={() => setActivePhotoIndex(Math.min(photos.length - 1, activePhotoIndex + 1))}
                  disabled={activePhotoIndex === photos.length - 1}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-30"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {/* Annotation form */}
          <div className="w-1/2 space-y-5">
            {/* Condition Rating */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Condition Rating
              </label>
              <div className="flex gap-2">
                {CONDITION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => updateAnnotation(activePhoto.id, { condition_rating: opt.value })}
                    disabled={!isReviewable}
                    className={`flex-1 rounded-lg border-2 px-2 py-2 text-xs font-bold transition-all ${
                      activeAnnotation.condition_rating === opt.value
                        ? opt.color + ' ring-2 ring-offset-1'
                        : 'border-gray-200 text-gray-500 hover:border-gray-400'
                    } disabled:opacity-50`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Direction / Angle */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Photo Direction / Angle
              </label>
              <input
                type="text"
                value={activeAnnotation.inferred_direction}
                onChange={(e) => updateAnnotation(activePhoto.id, { inferred_direction: e.target.value })}
                disabled={!isReviewable}
                placeholder="e.g. Front elevation facing north, rear yard showing drainage"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744] disabled:bg-gray-100"
              />
            </div>

            {/* Professional Caption */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Professional Caption
              </label>
              <p className="text-xs text-gray-500 mb-1">
                Formal caption for the appraisal report. Emphasize condition concerns the county is missing.
              </p>
              <textarea
                value={activeAnnotation.professional_caption}
                onChange={(e) => updateAnnotation(activePhoto.id, { professional_caption: e.target.value })}
                disabled={!isReviewable}
                rows={2}
                placeholder="e.g. Front elevation showing significant deferred maintenance including aged roofing materials and deteriorating fascia boards..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744] disabled:bg-gray-100"
              />
            </div>

            {/* Defects */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-semibold text-gray-900">
                  Defects ({activeAnnotation.defects.length})
                </label>
                {isReviewable && (
                  <button
                    onClick={() => addDefect(activePhoto.id)}
                    className="rounded-lg bg-[#1a2744] px-3 py-1 text-xs font-medium text-white hover:bg-[#243356]"
                  >
                    + Add Defect
                  </button>
                )}
              </div>

              {activeAnnotation.defects.length === 0 ? (
                <p className="text-xs text-gray-400 italic py-2">
                  No defects documented. Click &quot;Add Defect&quot; if you see issues.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeAnnotation.defects.map((defect, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-gray-200 bg-white p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-bold text-gray-500">Defect #{i + 1}</span>
                        {isReviewable && (
                          <button
                            onClick={() => removeDefect(activePhoto.id, i)}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      {/* Defect Type - quick select + custom */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                        <div className="flex flex-wrap gap-1 mb-1">
                          {COMMON_DEFECT_TYPES.map((type) => (
                            <button
                              key={type}
                              onClick={() => updateDefect(activePhoto.id, i, { type })}
                              disabled={!isReviewable}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium border transition-colors ${
                                defect.type === type
                                  ? 'bg-[#1a2744] text-white border-[#1a2744]'
                                  : 'border-gray-200 text-gray-600 hover:border-gray-400'
                              } disabled:opacity-50`}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={defect.type}
                          onChange={(e) => updateDefect(activePhoto.id, i, { type: e.target.value })}
                          disabled={!isReviewable}
                          placeholder="Or type custom defect..."
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs disabled:bg-gray-100"
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          What do you see?
                        </label>
                        <textarea
                          value={defect.description}
                          onChange={(e) => updateDefect(activePhoto.id, i, { description: e.target.value })}
                          disabled={!isReviewable}
                          rows={2}
                          placeholder="Describe exactly what you see — be specific about location, extent, and what it means..."
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs disabled:bg-gray-100"
                        />
                      </div>

                      {/* Severity + Value Impact */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Severity</label>
                          <select
                            value={defect.severity}
                            onChange={(e) => updateDefect(activePhoto.id, i, { severity: e.target.value as DefectDraft['severity'] })}
                            disabled={!isReviewable}
                            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs disabled:bg-gray-100"
                          >
                            <option value="minor">Minor (-0.5% to -1.5%)</option>
                            <option value="moderate">Moderate (-1% to -3%)</option>
                            <option value="significant">Significant (-2% to -5%)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Value Impact</label>
                          <select
                            value={defect.value_impact}
                            onChange={(e) => updateDefect(activePhoto.id, i, { value_impact: e.target.value as DefectDraft['value_impact'] })}
                            disabled={!isReviewable}
                            className="w-full rounded border border-gray-200 px-2 py-1.5 text-xs disabled:bg-gray-100"
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </div>
                      </div>

                      {/* Report Language */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Report Language
                        </label>
                        <p className="text-[10px] text-gray-400 mb-1">
                          Formal statement for the appraisal report tying this defect to value impact.
                        </p>
                        <textarea
                          value={defect.report_language}
                          onChange={(e) => updateDefect(activePhoto.id, i, { report_language: e.target.value })}
                          disabled={!isReviewable}
                          rows={2}
                          placeholder="e.g. The subject property exhibits significant roof deterioration including curling shingles and aged flashing, indicating deferred maintenance that would require approximately $8,000-$12,000 in remediation costs..."
                          className="w-full rounded border border-gray-200 px-2 py-1 text-xs disabled:bg-gray-100"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Comparable Adjustment Note */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Comparable Adjustment Note (Optional)
              </label>
              <textarea
                value={activeAnnotation.comparable_adjustment_note}
                onChange={(e) => updateAnnotation(activePhoto.id, { comparable_adjustment_note: e.target.value })}
                disabled={!isReviewable}
                rows={2}
                placeholder="How should this condition affect comparisons? e.g. Comparable sales were in superior condition, requiring negative adjustments of 5-8%..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1a2744] focus:outline-none focus:ring-1 focus:ring-[#1a2744] disabled:bg-gray-100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom action bar */}
      {isReviewable && (
        <div className="sticky bottom-0 mt-8 border-t border-gray-200 bg-white px-6 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">{completedCount}</span> of{' '}
              <span className="font-semibold">{photos.length}</span> photos annotated
              {!allComplete && (
                <span className="ml-2 text-orange-600">
                  (each photo needs a direction and caption)
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSaveAnnotations}
                disabled={isPending}
                className="rounded-xl border-2 border-[#1a2744] px-6 py-3 text-sm font-bold text-[#1a2744] transition-colors hover:bg-[#1a2744] hover:text-white disabled:opacity-50"
              >
                {isPending ? 'Saving...' : 'Save Progress'}
              </button>
              <button
                onClick={handleCompleteAndResume}
                disabled={isPending || !allComplete}
                className="rounded-xl bg-green-700 px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-green-800 disabled:opacity-50"
              >
                {isPending ? 'Processing...' : 'Complete Review & Resume Pipeline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
