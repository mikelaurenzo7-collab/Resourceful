import type { Metadata } from 'next';

import FunnelAnalytics from '@/components/intake/FunnelAnalytics';
import WizardLayout from '@/components/intake/WizardLayout';

export const metadata: Metadata = {
  title: 'Start Your Property Review',
  description:
    'Choose the property decision, verify jurisdiction and scope, organize available evidence, and select the appropriate analysis or guided-support package before payment.',
  openGraph: {
    title: 'Start Your Property Review | Resourceful',
    description:
      'Verify scope before payment, organize source-linked evidence, and choose the appropriate review or guided-support path.',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return (
    <WizardLayout>
      <FunnelAnalytics />
      {children}
    </WizardLayout>
  );
}
