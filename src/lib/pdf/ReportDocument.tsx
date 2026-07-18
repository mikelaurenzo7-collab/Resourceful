// ─── Report Document (Root) ──────────────────────────────────────────────────
// Composes one branded report system from a case-specific section profile.

import React from 'react';
import { Document, Page } from '@react-pdf/renderer';
import { theme } from './styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import { resolveAssignmentKind } from '@/lib/assignments/routing';
import { hasReleaseReadyIncomeApproach } from './section-data';
import {
  buildReportProfile,
  REPORT_NARRATIVE_SECTION_SPECS,
  type ReportNarrativeSectionKey,
} from './report-profile';
import { PageFooter, SectionHeader, NarrativeBlock } from './components/shared';

import LetterOfTransmittal from './components/LetterOfTransmittal';
import CoverPage from './components/CoverPage';
import TableOfContents from './components/TableOfContents';
import ExecutiveSummary from './components/ExecutiveSummary';
import PropertyDetails from './components/PropertyDetails';
import SubjectPhotoExhibit from './components/SubjectPhotoExhibit';
import CompsGrid from './components/CompsGrid';
import ComparableSaleProfiles from './components/ComparableSaleProfiles';
import AdjustmentReconciliation from './components/AdjustmentReconciliation';
import AssessmentRatioAnalysis from './components/AssessmentRatioAnalysis';
import CostApproachTable from './components/CostApproachTable';
import IncomeApproachTable from './components/IncomeApproachTable';
import ConditionSection from './components/ConditionSection';
import FilingGuide from './components/FilingGuide';
import Disclaimer from './components/Disclaimer';
import AssignmentAndScope from './components/AssignmentAndScope';
import SummaryOfSalientFacts from './components/SummaryOfSalientFacts';
import CertificationAndLimitingConditions from './components/CertificationAndLimitingConditions';

const SECTION_SPEC_BY_KEY = new Map(
  REPORT_NARRATIVE_SECTION_SPECS.map((section) => [section.key, section])
);

function NarrativeSectionPage({
  sectionKey,
  content,
}: {
  sectionKey: ReportNarrativeSectionKey;
  content: string | undefined;
}) {
  if (!content) return null;
  const section = SECTION_SPEC_BY_KEY.get(sectionKey);
  if (!section) return null;

  return (
    <Page size="LETTER" style={theme.page}>
      <PageFooter />
      <SectionHeader number={section.number} title={section.title} />
      <NarrativeBlock content={content} />
    </Page>
  );
}

export default function ReportDocument({ data }: { data: ReportTemplateData }) {
  const narrativeMap = new Map(data.narratives.map((n) => [n.section_name, n.content]));
  const assignmentKind = resolveAssignmentKind(
    data.report.service_type,
    data.report.desired_outcome
  );
  const profile = buildReportProfile(data);
  const hasIncomeApproach = hasReleaseReadyIncomeApproach(data);
  const hasCostApproach =
    data.property.cost_approach_value != null && data.property.cost_approach_value > 0;
  const hasConditionDefects = data.photos.some(
    (photo) => (photo.ai_analysis?.defects?.length ?? 0) > 0
  );

  const narrativePage = (sectionKey: ReportNarrativeSectionKey) => (
    <NarrativeSectionPage
      sectionKey={sectionKey}
      content={narrativeMap.get(sectionKey)}
    />
  );

  return (
    <Document
      title={`${profile.documentTitle} — ${data.report.property_address}`}
      author="Resourceful"
      subject={profile.documentTitle}
      keywords={`property valuation, ${profile.assignmentKind}, ${data.report.property_type}, ${profile.id}`}
    >
      <CoverPage data={data} />
      <LetterOfTransmittal data={data} />
      <TableOfContents data={data} />

      {narrativeMap.get('summary_of_salient_facts') && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <SummaryOfSalientFacts content={narrativeMap.get('summary_of_salient_facts')!} />
        </Page>
      )}

      <Page size="LETTER" style={theme.page}>
        <PageFooter />
        <PropertyDetails data={data} />
      </Page>

      <Page size="LETTER" style={theme.page}>
        <PageFooter />
        <ExecutiveSummary data={data} />
      </Page>

      <SubjectPhotoExhibit data={data} />

      {narrativeMap.get('assignment_and_scope') && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <AssignmentAndScope content={narrativeMap.get('assignment_and_scope')!} />
        </Page>
      )}

      {narrativePage('property_history')}
      {narrativePage('assessment_data')}
      {narrativePage('property_description')}
      {narrativePage('site_description_narrative')}
      {narrativePage('improvement_description_narrative')}
      {narrativePage('condition_assessment')}

      {hasConditionDefects && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <ConditionSection data={data} />
        </Page>
      )}

      {narrativePage('area_analysis_county')}
      {narrativePage('area_analysis_city')}
      {narrativePage('area_analysis_neighborhood')}
      {narrativePage('market_analysis')}
      {narrativePage('hbu_as_vacant')}
      {narrativePage('hbu_as_improved')}

      {profile.isTaxAppeal && narrativePage('appeal_argument_summary')}
      {narrativePage('sales_comparison_narrative')}

      {data.comparableSales.length > 0 && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <CompsGrid data={data} />
        </Page>
      )}

      <ComparableSaleProfiles data={data} />
      {narrativePage('adjustment_grid_narrative')}

      {hasIncomeApproach && narrativePage('income_approach_narrative')}
      {hasIncomeApproach && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <IncomeApproachTable data={data} />
        </Page>
      )}

      {hasCostApproach && narrativePage('cost_approach_narrative')}
      {hasCostApproach && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <CostApproachTable data={data} />
        </Page>
      )}

      {profile.isTaxAppeal && narrativePage('assessment_equity')}
      {profile.isTaxAppeal && data.property.assessment_ratio != null && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <AssessmentRatioAnalysis data={data} />
        </Page>
      )}

      <Page size="LETTER" style={theme.page}>
        <PageFooter />
        <AdjustmentReconciliation data={data} />
      </Page>

      {data.filingGuide && assignmentKind === 'tax_appeal' && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <FilingGuide guide={data.filingGuide} />
        </Page>
      )}

      {assignmentKind === 'pre_listing' && narrativeMap.get('pricing_strategy_guide') && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <SectionHeader number="ADD-A" title="Pricing Strategy Guide" />
          <NarrativeBlock content={narrativeMap.get('pricing_strategy_guide')!} />
        </Page>
      )}

      {assignmentKind === 'pre_purchase' && narrativeMap.get('negotiation_guide') && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <SectionHeader number="ADD-A" title="Negotiation Strategy Guide" />
          <NarrativeBlock content={narrativeMap.get('negotiation_guide')!} />
        </Page>
      )}

      {assignmentKind === 'independent_valuation' && narrativeMap.get('valuation_use_guide') && (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <SectionHeader number="ADD-A" title="Valuation Use & Next-Step Guide" />
          <NarrativeBlock content={narrativeMap.get('valuation_use_guide')!} />
        </Page>
      )}

      {narrativePage('hearing_script')}

      {narrativeMap.get('certification_and_limiting_conditions') ? (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <CertificationAndLimitingConditions
            content={narrativeMap.get('certification_and_limiting_conditions')!}
          />
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
