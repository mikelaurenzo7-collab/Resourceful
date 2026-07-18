import { getAppUrl } from '@/lib/utils/app-url';

const baseUrl = getAppUrl();

export function OrganizationJsonLd() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Resourceful',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description:
      'An AI-assisted, human-controlled property analysis service for assessment review, comparable evidence, condition documentation, and jurisdiction-specific next-step guidance.',
    foundingDate: '2025',
    areaServed: { '@type': 'Country', name: 'United States' },
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@resourceful.app',
      contactType: 'customer service',
      availableLanguage: 'English',
    },
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
    name: 'Resourceful',
    url: baseUrl,
    description:
      'Property tax appeal evidence, assessment review, and property decision support with clear sources, limitations, and service boundaries.',
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
    serviceType: 'Property Assessment and Appeal Evidence Analysis',
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
      'Property assessment review, comparable-sales analysis, condition evidence, and jurisdiction-specific next-step guidance. Filing and regulated professional services are available only when separately confirmed and engaged.',
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Resourceful Property Analysis Services',
      itemListElement: [
        {
          '@type': 'Offer',
          name: 'Property Tax Appeal Case Analysis',
          price: '49.00',
          priceCurrency: 'USD',
          description:
            'A reviewable property-tax appeal evidence package with assessment analysis, comparable sales, condition documentation, source notes, and a jurisdiction-specific next-step checklist.',
          url: `${baseUrl}/start?service=tax_appeal`,
        },
        {
          '@type': 'Offer',
          name: 'Expert-Reviewed Property Tax Appeal Analysis',
          price: '149.00',
          priceCurrency: 'USD',
          description:
            'A property-tax appeal case analysis with additional professional review of the evidence, conclusions, and customer-ready work product.',
          url: `${baseUrl}/start?service=tax_appeal&tier=expert-reviewed`,
        },
        {
          '@type': 'Offer',
          name: 'Guided Property Tax Appeal Filing Support',
          price: '199.00',
          priceCurrency: 'USD',
          description:
            'Expert-reviewed analysis plus a live filing-preparation and hearing-preparation session. The customer remains responsible for filing unless a separate written engagement states otherwise.',
          url: `${baseUrl}/start?service=tax_appeal&tier=guided-filing`,
        },
        {
          '@type': 'Offer',
          name: 'Pre-Purchase Property Review',
          price: '59.00',
          priceCurrency: 'USD',
          description:
            'A property decision analysis covering available value evidence, assessment and tax context, property facts, and material open questions before purchase.',
          url: `${baseUrl}/start?service=pre_purchase`,
        },
        {
          '@type': 'Offer',
          name: 'Pre-Listing Property Review',
          price: '59.00',
          priceCurrency: 'USD',
          description:
            'A property decision analysis covering value evidence, assessment and tax context, condition documentation, and buyer-ready discussion points before listing.',
          url: `${baseUrl}/start?service=pre_listing`,
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
        name: 'What does Resourceful help me decide?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Resourceful helps customers understand whether available evidence supports challenging an assessment, evaluating a purchase, or preparing a listing. The analysis organizes property records, relevant comparable sales, condition evidence, tax and assessment context, source limitations, and the next supported action.',
        },
      },
      {
        '@type': 'Question',
        name: 'What do I receive with a tax-appeal case?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'The package may include a property and assessment summary, comparable-sales analysis, adjustment support, condition evidence, an evidence index, the requested-value rationale, jurisdiction-specific filing guidance, and clear limitations. Contents depend on the property, available data, jurisdiction, and service level.',
        },
      },
      {
        '@type': 'Question',
        name: 'Does Resourceful file or represent me?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Not by default. Case Analysis and Expert Review are analysis services, and Guided Filing supports the customer while the customer remains responsible for filing. Filing, representation, or attorney services require jurisdiction eligibility, appropriate professional availability, authorization, and a separate written engagement.',
        },
      },
      {
        '@type': 'Question',
        name: 'Is this a licensed appraisal or legal advice?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. A standard Resourceful work product is an AI-assisted property analysis, not legal advice, a certified appraisal, a lender appraisal, or a USPAP appraisal. Regulated professional services are provided only through a separately engaged and appropriately credentialed professional who assumes responsibility for that work.',
        },
      },
      {
        '@type': 'Question',
        name: 'How is AI used?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'AI assists with extraction, research organization, comparable screening, drafting, and workflow support. It does not create filing authority, guarantee an outcome, replace required professional judgment, or turn an unsigned analysis into a licensed appraisal.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can Resourceful guarantee a reduction or tax savings?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'No. Assessment authorities decide each matter independently. Resourceful does not guarantee eligibility, acceptance, a lower assessment, tax savings, or a favorable hearing result. Any refund protection applies only under the written conditions in the Terms of Service.',
        },
      },
      {
        '@type': 'Question',
        name: 'Can filing an appeal increase my assessment?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'That risk depends on the jurisdiction and the facts. Resourceful does not claim that an assessment can never increase. Customers should confirm the applicable review authority, scope of review, deadline, and local rules before filing.',
        },
      },
      {
        '@type': 'Question',
        name: 'Where does the property data come from?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Resourceful uses available public records and approved third-party or licensed sources. Data quality and coverage vary by location. Important facts, comparable sales, deadlines, and filing requirements should be source-labeled and independently reviewable.',
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
