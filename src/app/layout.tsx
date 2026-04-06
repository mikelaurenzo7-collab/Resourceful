import type { Metadata } from "next";
import Script from "next/script";
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/seo/JsonLd";
import "./globals.css";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://resourceful.app";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: {
    default: "REsourceful | Professional Property Tax Appeal Reports",
    template: "%s | REsourceful",
  },
  description:
    "Expert-grade property tax appeal reports nationwide. Comparable sales analysis, assessment review, and pro se filing guidance. Save hundreds to thousands on your property taxes with our money-back guarantee.",
  keywords: [
    "property tax appeal",
    "property tax appeal report",
    "tax assessment appeal",
    "property valuation",
    "tax reduction",
    "pro se tax appeal",
    "property tax protest",
    "reduce property taxes",
    "property tax savings",
    "comparable sales analysis",
    "over-assessed property",
    "Board of Review appeal",
    "assessment appeal",
    "lower property taxes",
  ],
  openGraph: {
    title: "REsourceful | Professional Property Tax Appeal Reports",
    description:
      "Expert-grade property tax appeal reports. Professional valuation evidence, comparable sales analysis, and step-by-step pro se filing guides for property owners nationwide.",
    type: "website",
    siteName: "REsourceful",
    url: baseUrl,
    locale: "en_US",
    images: [
      {
        url: `${baseUrl}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "REsourceful — Professional Property Tax Appeal Reports",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "REsourceful | Property Tax Appeal Reports",
    description:
      "Save hundreds to thousands on your property taxes. Professional appeal reports with money-back guarantee.",
    images: [`${baseUrl}/og-image.png`],
  },
  alternates: {
    canonical: baseUrl,
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
  const googleMapsKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <OrganizationJsonLd />
        <WebSiteJsonLd />
      </head>
      <body className="font-sans antialiased bg-[#0f1419] text-[#f5f0e8] min-h-screen" style={{ ['--font-inter' as string]: "'Inter', system-ui, sans-serif", ['--font-playfair' as string]: "'Playfair Display', Georgia, serif" }}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-gold focus:text-navy-deep focus:rounded-lg focus:font-medium focus:text-sm"
        >
          Skip to main content
        </a>
        <main id="main-content">
        {children}
        </main>
        {googleMapsKey && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places,drawing,geometry`}
            strategy="lazyOnload"
          />
        )}
      </body>
    </html>
  );
}
