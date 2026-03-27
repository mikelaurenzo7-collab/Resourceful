import type { MetadataRoute } from 'next';
import { getActiveCounties } from '@/lib/repository/county-rules';
import { buildCountySlug } from '@/lib/utils/county-slug';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app';

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${baseUrl}/start`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/disclaimer`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  // Generate county appeal landing page entries
  let countyPages: MetadataRoute.Sitemap = [];
  try {
    const counties = await getActiveCounties();
    countyPages = counties.map((c) => ({
      url: `${baseUrl}/appeal/${buildCountySlug(c.county_name, c.state_abbreviation)}`,
      lastModified: new Date(c.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }));
  } catch {
    // If DB is unavailable, return static pages only
  }

  return [...staticPages, ...countyPages];
}
