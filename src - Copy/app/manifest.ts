import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'REsourceful',
    short_name: 'REsourceful',
    description: 'Expert-grade property tax appeal reports nationwide.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f1419',
    theme_color: '#d4a847',
    icons: [
      {
        src: '/favicon.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
      {
        src: '/favicon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
