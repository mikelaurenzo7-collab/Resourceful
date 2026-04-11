// ─── Structured Data (JSON-LD) ───────────────────────────────────────────────
// All schemas rendered in <head> or page-level for rich search results.

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://resourceful.app';

export function OrganizationJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'REsourceful',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description:
      'An AI-powered property tax reduction platform. Claude Sonnet and Gemini run comparable analysis, case assembly, and filing support for property owners nationwide.',
    foundingDate: '2025',
    areaServed: { '@type': 'Country', name: 'United States' },
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@resourceful.app',
      contactType: 'customer service',
      availableLanguage: 'English',
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
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'REsourceful',
    url: baseUrl,
    description: 'An AI-led property tax operator for valuation research, case assembly, and filing support.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${baseUrl}/start?address={address}`,
      },
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

export function ServiceJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'AI Property Tax Reduction Service',
    provider: {
      '@type': 'Organization',
      name: 'REsourceful',
      url: baseUrl,
    },
    areaServed: {
      '@type': 'Country',
      name: 'United States',
    },
    description:
      'AI-led property tax reduction services with comparable sales analysis, assessment review, county-specific workflow guidance, and optional full execution support for homeowners in all 50 states.',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'AI Property Intelligence Offers',
      itemListElement: [
        {
          '@type': 'Offer',
          name: 'Tax Reduction Engine',
          price: '49.00',
          priceCurrency: 'USD',
          description:
            'AI-built tax reduction case package with comparable sales analysis, assessment review, condition documentation, and county-specific action guidance.',
          url: `${baseUrl}/start`,
        },
        {
          '@type': 'Offer',
          name: 'Operator Mode',
          price: '149.00',
          priceCurrency: 'USD',
          description:
            'AI-led property tax case package with expert review, enhanced comparable analysis, and detailed execution guidance.',
          url: `${baseUrl}/start`,
        },
        {
          '@type': 'Offer',
          name: 'Autopilot Appeal',
          price: '399.00',
          priceCurrency: 'USD',
          description:
            'High-leverage appeal service where AI runs the workflow and the team handles filing, representation, and full-process management.',
          url: `${baseUrl}/start?tier=full-representation`,
        },
        {
          '@type': 'Offer',
          name: 'Acquisition Intelligence',
          price: '59.00',
          priceCurrency: 'USD',
          description:
            'AI-led acquisition analysis for buyers with market valuation, tax projections, and appeal feasibility assessment.',
          url: `${baseUrl}/start`,
        },
        {
          '@type': 'Offer',
          name: 'Seller Strategy Intelligence',
          price: '59.00',
          priceCurrency: 'USD',
          description:
            'AI-led seller analysis with market valuation, tax projections, and listing-ready strategy materials.',
          url: `${baseUrl}/start`,
        },
      ],
    },
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
        name: 'Do I have to file the appeal myself?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Not necessarily. With our Full Representation package, we file the appeal on your behalf and attend the hearing as your authorized representative. With Guided Filing, we walk you through every step on a live call. Even with our standard report, you get a step-by-step filing guide tailored to your county. Property tax appeals are one of the most accessible processes for self-representation.',
        },
      },
      {
        '@type': 'Question',
        name: 'What makes your report credible to the Board of Review?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Our reports are built on the same evidence standards professional appraisers use: comparable sales analysis with line-item adjustments, assessment ratio calculations, and condition documentation with photographs. We use the same data sources assessors rely on. The Board of Review evaluates the quality of evidence presented, not credentials.',
        },
      },
      {
        '@type': 'Question',
        name: 'How long does it take to receive my report?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Most reports are delivered within 48 hours of completing your submission. Complex commercial or industrial properties may take up to 72 hours. You\'ll receive a notification when your report is ready, and you can download it directly from your dashboard.',
        },
      },
      {
        '@type': 'Question',
        name: 'What if I don\'t win my appeal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'There is no penalty for filing an appeal — your taxes will never go up as a result. Properties with documented over-assessment and strong comparable sales evidence succeed the majority of the time. Even partial reductions result in meaningful savings. Our reports include a satisfaction guarantee.',
        },
      },
      {
        '@type': 'Question',
        name: 'How accurate is your analysis?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Our analysis follows IAAO (International Association of Assessing Officers) standards for mass appraisal. We use 5-10 comparable sales with line-item adjustments for size, age, condition, and location — the same methodology licensed appraisers use. Our calibration system continuously improves accuracy by comparing concluded values against actual outcomes.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can real estate agents use this instead of a CMA?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Yes. Our Pre-Listing and Pre-Purchase reports go deeper than a traditional CMA with assessment ratio analysis, tax appeal feasibility, condition-based adjustments from photos, and a formal adjustment grid. Agents use these to strengthen listings and address buyer concerns about property taxes.',
        },
      },
      {
        '@type': 'Question',
        name: 'What happens after I file my appeal?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Timelines vary by county. Most counties schedule a hearing within 30-90 days of filing. Some offer an informal review first. At the hearing, you present the evidence from your report. The board issues a decision within 2-4 weeks. If unsatisfied, most states allow a further appeal to a state-level board. Your report includes all of this detail for your specific county.',
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
