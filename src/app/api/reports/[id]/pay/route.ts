// ─── Pay for Report API ─────────────────────────────────────────────────────
// POST: Create a Stripe PaymentIntent for an approved report.
// Only works when report status is 'approved' (report ready, not yet paid).
// Returns client secret for Stripe Elements checkout on the report viewer page.

import { NextRequest, NextResponse } from 'next/server';
import { createPaymentIntent } from '@/lib/services/stripe-service';
import { getReportById, updateReport } from '@/lib/repository/reports';
import { applyRateLimit } from '@/lib/rate-limit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // ── Rate limit: 10 payment attempts per 15 minutes per IP ────────────
    const rateLimited = await applyRateLimit(request, { prefix: 'pay-report', limit: 10, windowSeconds: 900 });
    if (rateLimited) return rateLimited;

    const { id: reportId } = await params;

    // ── Fetch report ─────────────────────────────────────────────────────
    const report = await getReportById(reportId);

    if (!report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    // ── Only allow payment for approved reports ──────────────────────────
    if (report.status !== 'approved') {
      return NextResponse.json(
        { error: 'Report is not ready for payment' },
        { status: 400 }
      );
    }

    // ── If PaymentIntent already exists and is still valid, return it ────
    if (report.stripe_payment_intent_id) {
      // Retrieve existing intent to check if it's still usable
      const { getPaymentIntent } = await import('@/lib/services/stripe-service');
      const { data: existingIntent } = await getPaymentIntent(report.stripe_payment_intent_id);

      if (existingIntent && existingIntent.status !== 'canceled' && existingIntent.status !== 'succeeded') {
        return NextResponse.json({
          clientSecret: existingIntent.clientSecret,
          priceCents: report.amount_paid_cents,
        });
      }
    }

    // ── Create new Stripe PaymentIntent ──────────────────────────────────
    const priceCents = report.amount_paid_cents ?? 0;

    if (priceCents <= 0) {
      return NextResponse.json(
        { error: 'Invalid report price' },
        { status: 400 }
      );
    }

    const { data: payment, error: paymentError } = await createPaymentIntent({
      amountCents: priceCents,
      customerEmail: report.client_email ?? '',
      reportId: report.id,
      metadata: {
        service_type: report.service_type ?? '',
        property_type: report.property_type ?? '',
      },
    });

    if (paymentError || !payment) {
      console.error('[api/reports/pay] Failed to create payment intent:', paymentError);
      return NextResponse.json(
        { error: 'Failed to create payment intent' },
        { status: 500 }
      );
    }

    // ── Store PaymentIntent ID on report ─────────────────────────────────
    await updateReport(report.id, {
      stripe_payment_intent_id: payment.id,
    });

    return NextResponse.json({
      clientSecret: payment.clientSecret,
      priceCents,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api/reports/pay] Unhandled error:', message);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
