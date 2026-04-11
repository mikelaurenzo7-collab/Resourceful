import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { Playfair_Display } from 'next/font/google';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

import { OrganizationJsonLd, WebSiteJsonLd } from '@/components/seo/JsonLd';
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

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app';

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "REsourceful | The AI Property Tax Operator",
    template: "%s | REsourceful",
  },
  description:
    "An AI-led property tax reduction company. Manus runs valuation research, case assembly, filing support, and workflow intelligence so property owners move faster and save more.",
  keywords: [
    "ai property tax",
    "property tax appeal",
    "tax reduction operator",
    "property valuation",
    "tax reduction",
    "property intelligence",
    "property tax protest",
    "reduce property taxes",
    "property tax savings",
    "comparable sales analysis",
    "assessment workflow",
    "board of review appeal",
    "assessment appeal",
    "ai cofounder",
  ],
  openGraph: {
    title: "REsourceful | The AI Property Tax Operator",
    description:
      "An AI-led property tax reduction company. Manus runs valuation research, comparable analysis, and filing support for property owners nationwide.",
    type: "website",
    siteName: "REsourceful",
    url: baseUrl,
    locale: "en_US",
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "REsourceful — The AI Property Tax Operator",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "REsourceful | The AI Property Tax Operator",
    description:
      "Manus runs property tax research, case assembly, and filing support so property owners move faster and save more.",
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
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
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
