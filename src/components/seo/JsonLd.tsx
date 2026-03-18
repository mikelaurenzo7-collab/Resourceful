export function OrganizationJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Resourceful',
    url: baseUrl,
    description:
      'Professional property tax appeal reports for homeowners nationwide. Comparable sales analysis, assessment review, and pro se filing guidance.',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@resourceful.app',
      contactType: 'customer service',
    },
    sameAs: [],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function WebSiteJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Resourceful',
    url: baseUrl,
    description: 'Professional property tax appeal reports with data-driven analysis.',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${baseUrl}/start`,
      'query-input': 'required name=address',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

import { PRICING } from '@/config/pricing';

export function ServiceJsonLd() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Property Tax Appeal Report',
    provider: {
      '@type': 'Organization',
      name: 'Resourceful',
      url: baseUrl,
    },
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
    description:
      'Property tax appeal reports with comparable sales analysis, assessment review, and county-specific pro se filing instructions. Money-back guarantee with photo documentation.',
    offers: [
      {
        '@type': 'Offer',
        name: 'Residential Tax Appeal Report',
        price: (PRICING.TAX_APPEAL_RESIDENTIAL / 100).toFixed(2),
        priceCurrency: 'USD',
        description:
          'Professional property tax appeal report for residential properties including comparable sales analysis, assessment review, and filing guide.',
      },
      {
        '@type': 'Offer',
        name: 'Commercial Tax Appeal Report',
        price: (PRICING.TAX_APPEAL_COMMERCIAL / 100).toFixed(2),
        priceCurrency: 'USD',
        description:
          'Commercial property tax appeal report with income analysis, comparable sales, and filing guide.',
      },
      {
        '@type': 'Offer',
        name: 'Pre-Purchase Property Analysis',
        price: (PRICING.PRE_PURCHASE / 100).toFixed(2),
        priceCurrency: 'USD',
        description:
          'Property analysis report for prospective buyers with valuation data and market comparables.',
      },
      {
        '@type': 'Offer',
        name: 'Pre-Listing Property Report',
        price: (PRICING.PRE_LISTING / 100).toFixed(2),
        priceCurrency: 'USD',
        description:
          'Property analysis report for sellers with market valuation and comparable sales data.',
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function FAQJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'How do I know if my property is over-assessed?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Over half of all properties in the U.S. are assessed above their actual market value. If your home\'s assessed value is higher than what comparable properties have recently sold for, you\'re likely overpaying. Our report analyzes recent sales in your area to determine whether your assessment is fair.',
        },
      },
      {
        '@type': 'Question',
        name: 'What makes your report credible to the Board of Review?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Our reports follow the same methodology used by professional appraisers and tax attorneys: comparable sales analysis with line-item adjustments, assessment ratio calculations, condition documentation, and clear market value conclusions. Every report is expert-reviewed before delivery. The Board evaluates evidence, not credentials.',
        },
      },
      {
        '@type': 'Question',
        name: 'Do I need an attorney to file an appeal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Property tax appeals are one of the most accessible legal processes for self-representation. Our report gives you the evidence, county-specific filing instructions, and hearing guidance you need to file on your own.',
        },
      },
      {
        '@type': 'Question',
        name: 'How long does it take to get my report?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Most reports are delivered within 1-2 business days. Every report goes through an expert review before delivery. You\'ll receive an email when your report is ready to download.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can my taxes go up if I file an appeal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Filing an appeal cannot increase your assessment. The worst possible outcome is that your assessment stays the same. There is no penalty or fee for filing an appeal.',
        },
      },
      {
        '@type': 'Question',
        name: 'How is this different from hiring an appraiser?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A traditional appraisal costs $300-$500, requires an in-person appointment, and takes 1-2 weeks. Our reports use the same data sources and methodology but deliver in 1-2 days at a fraction of the cost, with county-specific filing instructions included.',
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
