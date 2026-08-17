// ─── Durable Pipeline Reconciler ─────────────────────────────────────────────
// Hourly safety net for legacy or externally-mutated report states. It never
// runs report generation itself. Missing ownership is repaired by inserting an
// idempotent pipeline_runs record at the first incomplete stage.

import { NextRequest, NextResponse } from 'next/server';

import { cronLogger } from '@/lib/logger';
import { enqueuePipelineRun } from '@/lib/pipeline/queue';
import { inferNextStageNumber } from '@/lib/pipeline/run-types';
import { sendAdminNotification } from '@/lib/services/resend-email';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyCronAuth } from '@/lib/utils/cron-auth';

const PAID_STALE_THRESHOLD_MS = 60 * 60 * 1000;
const PROCESSING_STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store, max-age=0' };

interface StaleReport {
  id: string;
  status: 'paid' | 'processing';
  created_at: string;
  pipeline_started_at: string | null;
  pipeline_last_completed_stage: string | null;
}

export async function GET(request: NextRequest) {
  const authFailure = verifyCronAuth(request);
  if (authFailure) return authFailure;

  const supabase = createAdminClient();
  const now = Date.now();
  const paidCutoff = new Date(
    now - PAID_STALE_THRESHOLD_MS
  ).toISOString();
  const processingCutoff = new Date(
    now - PROCESSING_STALE_THRESHOLD_MS
  ).toISOString();
  const recoveryAttempt = new Date(now).toISOString();

  try {
    const [{ data: stalePaid, error: paidError }, {
      data: staleProcessing,
      error: processingError,
    }] = await Promise.all([
      supabase
        .from('reports')
        .select(
          'id, status, created_at, pipeline_started_at, pipeline_last_completed_stage'
        )
        .eq('status', 'paid')
        .lt('created_at', paidCutoff)
        .limit(50),
      supabase
        .from('reports')
        .select(
          'id, status, created_at, pipeline_started_at, pipeline_last_completed_stage'
        )
        .eq('status', 'processing')
        .lt('pipeline_started_at', processingCutoff)
        .limit(50),
    ]);

    if (paidError) {
      throw new Error(
        `Failed to inspect paid reports: ${paidError.message}`
      );
    }
    if (processingError) {
      throw new Error(
        `Failed to inspect processing reports: ${processingError.message}`
      );
    }

    const candidates = [
      ...((stalePaid ?? []) as unknown as StaleReport[]),
      ...((staleProcessing ?? []) as unknown as StaleReport[]),
    ];

    let ownershipEstablished = 0;
    let ownershipAlreadyActive = 0;
    let enqueueFailures = 0;

    for (const report of candidates) {
      try {
        const idempotencyKey = [
          'stale',
          report.id,
          report.status,
          recoveryAttempt,
        ].join(':');
        const run = await enqueuePipelineRun({
          reportId: report.id,
          source: 'stale_recovery',
          idempotencyKey,
          startStage: inferNextStageNumber(
            report.pipeline_last_completed_stage
          ),
          metadata: {
            recovered_from_status: report.status,
            detected_at: new Date(now).toISOString(),
            last_completed_stage:
              report.pipeline_last_completed_stage,
          },
        });

        if (
          run.source === 'stale_recovery' &&
          run.idempotency_key === idempotencyKey
        ) {
          ownershipEstablished += 1;
        } else {
          ownershipAlreadyActive += 1;
        }

        cronLogger.info(
          {
            reportId: report.id,
            previousStatus: report.status,
            runId: run.id,
            runStatus: run.status,
            currentStage: run.current_stage,
          },
          '[stale-pipeline] Durable ownership confirmed'
        );
      } catch (error) {
        enqueueFailures += 1;
        cronLogger.error(
          {
            reportId: report.id,
            previousStatus: report.status,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
          '[stale-pipeline] Failed to establish durable ownership'
        );
      }
    }

    if (candidates.length > 0) {
      try {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
        const notification = await sendAdminNotification({
          reportId: 'stale-pipeline-summary',
          propertyAddress: `${candidates.length} stale report state(s) reconciled`,
          propertyType: 'residential',
          reviewUrl: `${appUrl}/admin/reports?status=processing`,
          clientEmail: undefined,
          county: undefined,
        });

        if (notification.error) {
          throw new Error(notification.error);
        }
      } catch (error) {
        cronLogger.error(
          {
            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
          '[stale-pipeline] Failed to send admin reconciliation alert'
        );
      }
    }

    const response = {
      success: enqueueFailures === 0,
      stalePaidFound: stalePaid?.length ?? 0,
      staleProcessingFound: staleProcessing?.length ?? 0,
      ownershipEstablished,
      ownershipAlreadyActive,
      enqueueFailures,
      timestamp: new Date().toISOString(),
    };

    cronLogger.info(
      response,
      '[stale-pipeline] Reconciliation complete'
    );

    return NextResponse.json(response, {
      status: enqueueFailures > 0 ? 500 : 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    cronLogger.error(
      { err: message },
      '[stale-pipeline] Reconciliation failed'
    );
    return NextResponse.json(
      { success: false, error: message },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
