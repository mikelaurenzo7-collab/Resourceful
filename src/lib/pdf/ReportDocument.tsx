// ─── Report Document (Root) ──────────────────────────────────────────────────
// Composes all page components into the final PDF document.

import React from 'react';
import { Document, Page, View, Image } from '@react-pdf/renderer';
import { theme } from './styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { PageFooter, SectionHeader, NarrativeBlock, PhotoGrid } from './components/shared';

import CoverPage from './components/CoverPage';
import ExecutiveSummary from './components/ExecutiveSummary';
import CompsGrid from './components/CompsGrid';
import AdjustmentReconciliation from './components/AdjustmentReconciliation';
import ConditionSection from './components/ConditionSection';
import AssessmentRatioAnalysis from './components/AssessmentRatioAnalysis';
import FilingGuide from './components/FilingGuide';
import Disclaimer from './components/Disclaimer';

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
      {/* Cover page — no footer */}
      <CoverPage data={data} />

      {/* Main content pages with footer */}
      <Page size="LETTER" style={theme.page}>
        <PageFooter />

        {/* Executive Summary */}
        <ExecutiveSummary data={data} />

        {/* Maps */}
        {data.maps.regional && (
          <View style={{ marginVertical: 8 }} wrap={false}>
            <Image src={data.maps.regional.url} style={{ width: '100%', height: 200 }} />
            <SectionHeader number="" title="" />
          </View>
        )}

        {/* Subject photos */}
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

      {/* Comparable Sales */}
      <Page size="LETTER" style={theme.page}>
        <PageFooter />
        <CompsGrid data={data} />
        <AdjustmentReconciliation data={data} />
      </Page>

      {/* Assessment Ratio (conditional) */}
      {data.property.assessment_ratio != null && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <AssessmentRatioAnalysis data={data} />
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

      {/* Certification & Disclaimer */}
      <Page size="LETTER" style={theme.page}>
        <PageFooter />
        <Disclaimer data={data} />
      </Page>
    </Document>
  );
}
