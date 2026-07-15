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
    default: "REsourceful | AI Property Tax Appeals",
    template: "%s | REsourceful",
  },
  description:
    "AI-assisted property tax appeals powered by GPT-5.6 Sol valuation analysis, comparable sales, condition evidence, county workflow guidance, and human review.",
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
    "AI-assisted valuation analysis",
    "GPT-5.6 Sol appraiser",
  ],
  openGraph: {
    title: "REsourceful | AI Property Tax Appeals",
    description:
      "AI-assisted property tax appeals with GPT-5.6 Sol valuation analysis, comparable evidence, filing guidance, and human review before delivery.",
    type: "website",
    siteName: "REsourceful",
    url: baseUrl,
    locale: "en_US",
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "REsourceful — AI-assisted property tax appeals",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "REsourceful | AI Property Tax Appeals",
    description:
      "Build a stronger property tax appeal with GPT-5.6 Sol valuation analysis, evidence assembly, county guidance, and human review.",
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
