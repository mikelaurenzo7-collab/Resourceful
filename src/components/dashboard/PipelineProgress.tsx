'use client';

import type { ReportStatus } from '@/types/database';
import { resolvePipelineStageIndex } from '@/lib/dashboard/pipeline-progress';

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

export default function PipelineProgress({ currentStatus, pipelineLastCompletedStage }: PipelineProgressProps) {
  const currentIndex = resolvePipelineStageIndex(currentStatus, pipelineLastCompletedStage);
  const isFailed = currentStatus === 'failed' || currentStatus === 'rejected';

  return (
    <div className="w-full">
      {/* Desktop: horizontal steps */}
      <div className="hidden md:flex items-center justify-between relative">
        {/* Background line */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-navy-light" />
        {/* Progress line */}
        <div
          className={`absolute top-5 left-0 h-0.5 transition-all duration-1000 ${
            isFailed
              ? 'bg-gradient-to-r from-gold-light via-gold to-red-500'
              : 'bg-gradient-to-r from-gold-light via-gold to-gold-dark'
          }`}
          style={{
            width: `${Math.max(0, (currentIndex / (stages.length - 1)) * 100)}%`,
          }}
        />

        {stages.map((stage, i) => {
          const isComplete = i < currentIndex;
          const isCurrent = i === currentIndex;
          const isErrorStep = isFailed && isCurrent;

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
                  ${isErrorStep ? 'bg-red-900/30 border-red-500 text-red-400' : ''}
                `}
              >
                {isComplete ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isErrorStep ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01" />
                  </svg>
                ) : (
                  <span className="text-xs font-bold">{i + 1}</span>
                )}
              </div>
              <span
                className={`
                  mt-3 text-xs font-medium text-center max-w-[80px]
                  ${
                    isErrorStep
                      ? 'text-red-400'
                      : isCurrent
                      ? 'text-gold'
                      : isComplete
                      ? 'text-cream/60'
                      : 'text-cream/30'
                  }
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
          const isErrorStep = isFailed && isCurrent;

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
                    ${isErrorStep ? 'bg-red-900/30 border-red-500 text-red-400' : ''}
                  `}
                >
                  {isComplete ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : isErrorStep ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4m0 4h.01" />
                    </svg>
                  ) : (
                    <span className="text-xs font-bold">{i + 1}</span>
                  )}
                </div>
                {i < stages.length - 1 && (
                  <div
                    className={`w-0.5 h-8 ${
                      isComplete ? 'bg-gold' : isErrorStep ? 'bg-red-500/50' : 'bg-navy-light'
                    }`}
                  />
                )}
              </div>
              <div className="pb-6">
                <p
                  className={`text-sm font-medium ${
                    isErrorStep
                      ? 'text-red-400'
                      : isCurrent
                      ? 'text-gold'
                      : isComplete
                      ? 'text-cream/60'
                      : 'text-cream/30'
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
