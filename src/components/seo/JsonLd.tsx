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
        name: 'What is a property tax appeal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'A property tax appeal is a formal request to your county\'s Board of Review to lower your property\'s assessed value. If your home is assessed higher than its true market value, you\'re paying more in taxes than you should. Successful appeals result in lower assessments and reduced annual tax bills, often saving homeowners hundreds to thousands of dollars per year.',
        },
      },
      {
        '@type': 'Question',
        name: 'What does "pro se" mean, and do I need an attorney?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Pro se means representing yourself without an attorney. Property tax appeals are one of the most accessible legal processes for self-representation. Our reports give you everything you need to file and argue your own appeal — the same quality of evidence that attorneys and tax consultants present.',
        },
      },
      {
        '@type': 'Question',
        name: 'What makes your report credible to the Board of Review?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Our reports follow the same methodology used by professional appraisers and tax attorneys: comparable sales analysis with line-item adjustments, assessment ratio calculations, condition documentation with photographs, and clear market value conclusions. The Board evaluates evidence, not credentials.',
        },
      },
      {
        '@type': 'Question',
        name: 'How long does it take to receive my report?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Most reports are delivered within a few hours of completing your submission. Complex commercial or industrial properties may take longer. You\'ll receive an email notification when your report is ready.',
        },
      },
      {
        '@type': 'Question',
        name: 'What if I don\'t win my appeal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'For photo-supported tax appeal reports, we offer a money-back guarantee. If your appeal is denied in full, send us the denial letter and we\'ll refund your full purchase price. There is no penalty for filing an appeal that isn\'t granted.',
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
