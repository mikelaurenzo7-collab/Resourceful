/** @type {import('next').NextConfig} */
const nextConfig = {
  // Externalize heavy native packages so they don't bloat the serverless bundle.
  // @sparticuz/chromium (~45MB) and puppeteer-core need to be loaded at runtime
  // rather than bundled into each function.
  serverExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.supabase.co",
              "frame-src https://js.stripe.com https://maps.googleapis.com",
              "connect-src 'self' https://*.supabase.co https://api.stripe.com https://maps.googleapis.com https://api.anthropic.com",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
