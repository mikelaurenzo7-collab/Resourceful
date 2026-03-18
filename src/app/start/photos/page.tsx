import { redirect } from 'next/navigation';

// Pre-payment photo upload removed from wizard flow (trust-first model).
// Photos are collected post-payment at /report/[id]/photos.
export default function PrePaymentPhotosPage() {
  redirect('/start/payment');
}
