import type { Metadata } from 'next';
import WizardLayout from '@/components/intake/WizardLayout';

export const metadata: Metadata = {
  title: 'Get Your Property Report',
  description:
    'Start your property tax appeal report in minutes. Enter your address, document property issues, upload photos, and receive a professional AI-generated appeal report with filing instructions for your county.',
  openGraph: {
    title: 'Get Your Property Report | Resourceful',
    description:
      'Start your property tax appeal report in minutes. Professional AI-generated reports with county-specific filing instructions.',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function StartLayout({ children }: { children: React.ReactNode }) {
  return <WizardLayout>{children}</WizardLayout>;
}
