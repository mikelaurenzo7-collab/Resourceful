import type { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/utils/app-url';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getAppUrl();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/dashboard/', '/start/', '/auth/', '/report/'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
