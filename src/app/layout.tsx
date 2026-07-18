import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Playfair_Display } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/seo/JsonLd';
import { getAppUrl } from '@/lib/utils/app-url';
import './globals.css';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-inter',
  weight: '100 900',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

const baseUrl = getAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: 'Resourceful | Property Tax Appeal Evidence and Filing Support',
    template: '%s | Resourceful',
  },
  description:
    'Review a property assessment, organize comparable sales and condition evidence, and understand the next supported filing step with an AI-assisted, human-controlled workflow.',
  keywords: [
    'property tax appeal',
    'property assessment review',
    'property tax protest',
    'comparable sales analysis',
    'condition evidence',
    'property tax filing support',
    'assessment appeal evidence',
    'property valuation analysis',
    'pre-purchase property review',
    'pre-listing property review',
  ],
  openGraph: {
    title: 'Resourceful | Property Tax Appeal Evidence and Filing Support',
    description:
      'Turn property records, comparable sales, condition evidence, and jurisdiction rules into a reviewable analysis and a clear next step.',
    type: 'website',
    siteName: 'Resourceful',
    url: baseUrl,
    locale: 'en_US',
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: 'Resourceful property assessment evidence and filing support',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Resourceful | Property Tax Appeal Evidence and Filing Support',
    description:
      'Review your assessment, inspect the evidence, and understand the next supported action.',
    images: [`${baseUrl}/og-image.png`],
  },
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <OrganizationJsonLd />
        <WebSiteJsonLd />
      </head>
      <body className={`${geistSans.variable} ${playfair.variable} font-sans antialiased bg-[#0f1419] text-[#f5f0e8] min-h-screen`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-gold focus:text-navy-deep focus:rounded-lg focus:font-medium focus:text-sm"
        >
          Skip to main content
        </a>
        <main id="main-content">
          {children}
        </main>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
