import type { MetadataRoute } from 'next';
import { getActiveCounties, getActiveStates } from '@/lib/repository/county-rules';
import { getAppUrl } from '@/lib/utils/app-url';
import { buildCountySlug } from '@/lib/utils/county-slug';
import { buildStateSlug } from '@/lib/utils/state-slug';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = getAppUrl();

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
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseUrl}/signup`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];

  let statePages: MetadataRoute.Sitemap = [];
  let countyPages: MetadataRoute.Sitemap = [];
  try {
    const [states, counties] = await Promise.all([
      getActiveStates(),
      getActiveCounties(),
    ]);

    statePages = states.map(s => ({
      url: `${baseUrl}/appeal/state/${buildStateSlug(s.state_name)}`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.85,
    }));

    countyPages = counties.map((c) => ({
      url: `${baseUrl}/appeal/${buildCountySlug(c.county_name, c.state_abbreviation)}`,
      lastModified: new Date(c.updated_at),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    }));
  } catch {
    // Database-backed location pages are additive; static routes remain valid.
  }

  return [...staticPages, ...statePages, ...countyPages];
}
