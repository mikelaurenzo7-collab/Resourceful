import { redirect } from 'next/navigation';

// Situation page removed from wizard flow (trust-first: no data collection before payment).
// Property details are collected post-payment alongside photos.
export default function SituationPage() {
  redirect('/start/payment');
}
