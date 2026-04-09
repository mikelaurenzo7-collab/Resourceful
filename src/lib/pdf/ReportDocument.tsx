// ─── Report Document (Root) ──────────────────────────────────────────────────
// Composes all page components into the final PDF document.

import React from 'react';
import { Document, Page, View, Image } from '@react-pdf/renderer';
import { theme } from './styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { PageFooter, SectionHeader, NarrativeBlock, PhotoGrid } from './components/shared';

import LetterOfTransmittal from './components/LetterOfTransmittal';
import CoverPage from './components/CoverPage';
import TableOfContents from './components/TableOfContents';
import ExecutiveSummary from './components/ExecutiveSummary';
import PropertyDetails from './components/PropertyDetails';
import CompsGrid from './components/CompsGrid';
import AdjustmentReconciliation from './components/AdjustmentReconciliation';
import AssessmentRatioAnalysis from './components/AssessmentRatioAnalysis';
import CostApproachTable from './components/CostApproachTable';
import IncomeApproachTable from './components/IncomeApproachTable';
import ConditionSection from './components/ConditionSection';
import FilingGuide from './components/FilingGuide';
import Disclaimer from './components/Disclaimer';
import AssignmentAndScope from './components/AssignmentAndScope';
import SummaryOfSalientFacts from './components/SummaryOfSalientFacts';
import PropertyHistory from './components/PropertyHistory';
import AssessmentData from './components/AssessmentData';
import CertificationAndLimitingConditions from './components/CertificationAndLimitingConditions';

// Narrative section keys mapped to display titles
const NARRATIVE_SECTIONS = [
  { key: 'property_description', num: 'II', title: 'Property Description' },
  { key: 'site_description_narrative', num: 'III', title: 'Site Description' },
  { key: 'improvement_description_narrative', num: 'IV', title: 'Improvement Description' },
  { key: 'area_analysis_county', num: 'V-A', title: 'Area Analysis — County' },
  { key: 'area_analysis_city', num: 'V-B', title: 'Area Analysis — City' },
  { key: 'area_analysis_neighborhood', num: 'V-C', title: 'Area Analysis — Neighborhood' },
  { key: 'market_analysis', num: 'VI', title: 'Market Analysis' },
  { key: 'hbu_as_vacant', num: 'VII-A', title: 'Highest & Best Use — As Vacant' },
  { key: 'hbu_as_improved', num: 'VII-B', title: 'Highest & Best Use — As Improved' },
] as const;

export default function ReportDocument({ data }: { data: ReportTemplateData }) {
  const narrativeMap = new Map(data.narratives.map(n => [n.section_name, n.content]));

  // Photos for summary section
  const summaryPhotos = data.photos
    .filter(p => p.storage_path)
    .slice(0, 4)
    .map(p => ({
      url: p.storage_path,
      caption: p.ai_analysis?.professional_caption ?? p.caption ?? p.photo_type ?? 'Photo',
    }));

  return (
    <Document
      title={`Property Report — ${data.report.property_address}`}
      author="Resourceful"
      subject="Property Tax Assessment Report"
    >
      {/* Letter of Transmittal — professional cover letter */}
      <LetterOfTransmittal data={data} />

      {/* Cover page — no footer */}
      <CoverPage data={data} />

      {/* Table of Contents */}
      <TableOfContents data={data} />


      {/* Assignment & Scope (J2C-style) */}
      {narrativeMap.get('assignment_and_scope') && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <AssignmentAndScope content={narrativeMap.get('assignment_and_scope')!} />
        </Page>
      )}

      {/* Summary of Salient Facts (J2C-style) */}
      {narrativeMap.get('summary_of_salient_facts') && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <SummaryOfSalientFacts content={narrativeMap.get('summary_of_salient_facts')!} />
        </Page>
      )}

      {/* Property History (J2C-style) */}
      {narrativeMap.get('property_history') && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <PropertyHistory content={narrativeMap.get('property_history')!} />
        </Page>
      )}

      {/* Assessment Data (J2C-style) */}
      {narrativeMap.get('assessment_data') && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <AssessmentData content={narrativeMap.get('assessment_data')!} />
        </Page>
      )}

      {/* Property Identification + Executive Summary */}
      <Page size="LETTER" style={theme.page}>
        <PageFooter />
        <PropertyDetails data={data} />
      </Page>

      {/* Executive Summary + Maps + Photos */}
      <Page size="LETTER" style={theme.page}>
        <PageFooter />
        <ExecutiveSummary data={data} />
        {data.maps.regional && (
          <View style={{ marginVertical: 8 }} wrap={false}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={data.maps.regional.url} style={{ width: '100%', height: 200 }} />
          </View>
        )}
        {summaryPhotos.length > 0 && <PhotoGrid photos={summaryPhotos} />}
      </Page>

      {/* Narrative sections */}
      <Page size="LETTER" style={theme.page}>
        <PageFooter />
        {NARRATIVE_SECTIONS.map(({ key, num, title }) => {
          const content = narrativeMap.get(key);
          if (!content) return null;
          return (
            <View key={key} break={key !== 'property_description'}>
              <SectionHeader number={num} title={title} />
              <NarrativeBlock content={content} />
            </View>
          );
        })}
      </Page>

      {/* Comparable Sales + Comps Map */}
      <Page size="LETTER" style={theme.page}>
        <PageFooter />
        <CompsGrid data={data} />
        {data.maps.neighborhood && (
          <View style={{ marginVertical: 8 }} wrap={false}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={data.maps.neighborhood.url} style={{ width: '100%', height: 220 }} />
          </View>
        )}
        <AdjustmentReconciliation data={data} />
      </Page>

      {/* Assessment Ratio (conditional) */}
      {data.property.assessment_ratio != null && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <AssessmentRatioAnalysis data={data} />
        </Page>
      )}

      {/* Cost Approach (conditional) */}
      {data.property.cost_approach_value != null && data.property.cost_approach_value > 0 && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <CostApproachTable data={data} />
        </Page>
      )}

      {/* Income Approach (conditional) */}
      {data.incomeAnalysis != null && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <IncomeApproachTable data={data} />
        </Page>
      )}

      {/* Condition Documentation (conditional) */}
      {data.photos.some(p => p.ai_analysis?.defects?.length) && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <ConditionSection data={data} />
        </Page>
      )}

      {/* Filing Guide (tax_appeal only) */}
      {data.filingGuide && data.report.service_type === 'tax_appeal' && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <FilingGuide guide={data.filingGuide} />
        </Page>
      )}

      {/* Pricing Strategy Guide (pre_listing only) */}
      {data.report.service_type === 'pre_listing' && narrativeMap.get('pricing_strategy_guide') && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <SectionHeader number="Addendum A" title="Pricing Strategy Guide" />
          <NarrativeBlock content={narrativeMap.get('pricing_strategy_guide')!} />
        </Page>
      )}

      {/* Negotiation Guide (pre_purchase only) */}
      {data.report.service_type === 'pre_purchase' && narrativeMap.get('negotiation_guide') && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <SectionHeader number="Addendum A" title="Negotiation Strategy Guide" />
          <NarrativeBlock content={narrativeMap.get('negotiation_guide')!} />
        </Page>
      )}

      {/* Certification & Limiting Conditions (J2C-style) */}
      {narrativeMap.get('certification_and_limiting_conditions') ? (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <CertificationAndLimitingConditions content={narrativeMap.get('certification_and_limiting_conditions')!} />
        </Page>
      ) : (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <Disclaimer data={data} />
        </Page>
      )}
    </Document>
  );
}
