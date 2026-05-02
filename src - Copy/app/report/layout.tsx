import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Secure Report | REsourceful',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
