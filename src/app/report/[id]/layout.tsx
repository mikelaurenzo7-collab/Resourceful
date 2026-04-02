import type { Metadata } from 'next';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
  title: 'Your Report | Resourceful',
};

export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
