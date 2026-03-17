'use client';

import type { ReportStatus } from '@/types/database';

interface PipelineProgressProps {
  currentStatus: ReportStatus;
  pipelineLastCompletedStage?: number | null;
}

const stages: { stage: number; label: string }[] = [
  { stage: 1, label: 'Payment Received' },
  { stage: 2, label: 'Data Collection' },
  { stage: 3, label: 'Photo Analysis' },
  { stage: 4, label: 'Report Generation' },
  { stage: 5, label: 'Quality Review' },
  { stage: 6, label: 'Approved' },
  { stage: 7, label: 'Delivered' },
];

// Fallback mapping from status to stage when pipeline_last_completed_stage is not available
const statusToStage: Record<string, number> = {
  intake: 0,
  paid: 1,
  data_pull: 2,
  photo_pending: 3,
  processing: 4,
  pending_approval: 5,
  approved: 6,
  delivered: 7,
};

export default function PipelineProgress({ currentStatus, pipelineLastCompletedStage }: PipelineProgressProps) {
  // Use pipeline_last_completed_stage (1-7) if available, otherwise derive from status
  const currentIndex = pipelineLastCompletedStage != null
    ? pipelineLastCompletedStage - 1
    : (statusToStage[currentStatus] ?? -1) - 1;
  const isFailed = currentStatus === 'failed' || currentStatus === 'rejected';

  return (
    <div className="w-full">
      {/* Desktop: horizontal steps */}
      <div className="hidden md:flex items-center justify-between relative">
        {/* Background line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-navy-light" />
        {/* Progress line */}
        <div
          className="absolute top-5 left-0 h-0.5 bg-gradient-to-r from-gold-light via-gold to-gold-dark transition-all duration-1000"
          style={{
            width: `${Math.max(0, (currentIndex / (stages.length - 1)) * 100)}%`,
          }}
        />

        {stages.map((stage, i) => {
          const isComplete = i < currentIndex;
          const isCurrent = i === currentIndex;

          return (
            <div key={stage.stage} className="relative flex flex-col items-center z-10">
              <div
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                  ${
                    isComplete
                      ? 'bg-gold border-gold text-navy-deep'
                      : isCurrent
                      ? 'bg-gold/20 border-gold text-gold animate-premium-pulse'
                      : 'bg-navy-deep border-navy-light text-cream/30'
                  }
                  ${isFailed && isCurrent ? 'bg-red-900/30 border-red-500 text-red-400' : ''}
                `}
              >
                {isComplete ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <span className="text-xs font-bold">{i + 1}</span>
                )}
              </div>
              <span
                className={`
                  mt-3 text-xs font-medium text-center max-w-[80px]
                  ${isCurrent ? 'text-gold' : isComplete ? 'text-cream/60' : 'text-cream/30'}
                `}
              >
                {stage.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical steps */}
      <div className="md:hidden space-y-0">
        {stages.map((stage, i) => {
          const isComplete = i < currentIndex;
          const isCurrent = i === currentIndex;

          return (
            <div key={stage.stage} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center border-2 flex-shrink-0
                    ${
                      isComplete
                        ? 'bg-gold border-gold text-navy-deep'
                        : isCurrent
                        ? 'bg-gold/20 border-gold text-gold'
                        : 'bg-navy-deep border-navy-light text-cream/30'
                    }
                  `}
                >
                  {isComplete ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold">{i + 1}</span>
                  )}
                </div>
                {i < stages.length - 1 && (
                  <div
                    className={`w-0.5 h-8 ${
                      isComplete ? 'bg-gold' : 'bg-navy-light'
                    }`}
                  />
                )}
              </div>
              <div className="pb-6">
                <p
                  className={`text-sm font-medium ${
                    isCurrent ? 'text-gold' : isComplete ? 'text-cream/60' : 'text-cream/30'
                  }`}
                >
                  {stage.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
