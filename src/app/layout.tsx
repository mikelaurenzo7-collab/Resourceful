import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resourceful | Professional Property Tax Appeal Reports",
  description:
    "Expert-grade property tax appeal reports nationwide. Professional comparable analysis, assessment review, and pro se filing guidance. Save thousands on your property taxes.",
  keywords: [
    "property tax appeal",
    "tax assessment",
    "property valuation",
    "tax reduction",
    "pro se",
  ],
  openGraph: {
    title: "Resourceful | Professional Property Tax Appeal Reports",
    description:
      "Expert-grade property tax appeal reports. Professional valuation evidence and step-by-step pro se filing guides for property owners nationwide.",
    type: "website",
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;0,800;0,900;1,400;1,500;1,600;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased bg-[#0f1419] text-[#f5f0e8] min-h-screen">
        {children}
        {googleMapsKey && (
          <Script
            src={`https://maps.googleapis.com/maps/api/js?key=${googleMapsKey}&libraries=places`}
            strategy="lazyOnload"
          />
        )}
      </body>
    </html>
  );
}
