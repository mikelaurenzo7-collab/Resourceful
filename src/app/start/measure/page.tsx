'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Measurements are now handled automatically via ATTOM data.
// This page redirects to payment.
export default function MeasurePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/start/payment');
  }, [router]);

  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-gold border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
