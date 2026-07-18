// ─── Report Document (Root) ──────────────────────────────────────────────────
// Composes one branded report system from the shared, case-specific render plan.

import React from 'react';
import { Document, Page } from '@react-pdf/renderer';
import { theme } from './styles/theme';
import type { ReportTemplateData } from '@/lib/templates/report-template';
import {
  buildReportRenderPlan,
  type ReportRenderPlan,
  type ReportRenderSection,
} from './report-render-plan';
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

function narrativeContent(
  section: ReportRenderSection,
  plan: ReportRenderPlan
): string | null {
  if (!section.narrativeKey) return null;
  return plan.narratives.get(section.narrativeKey) ?? null;
}

function NarrativeSectionPage({
  section,
  content,
}: {
  section: ReportRenderSection;
  content: string;
}) {
  return (
    <Page size="LETTER" style={theme.page}>
      <PageFooter />
      <SectionHeader number={section.number} title={section.title} />
      <NarrativeBlock content={content} />
    </Page>
  );
}

function renderSection(
  section: ReportRenderSection,
  data: ReportTemplateData,
  plan: ReportRenderPlan
): React.ReactNode {
  const content = narrativeContent(section, plan);

  switch (section.kind) {
    case 'letter':
      return <LetterOfTransmittal data={data} />;
    case 'summary':
      return content ? (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <SummaryOfSalientFacts content={content} />
        </Page>
      ) : null;
    case 'property_facts':
      return (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <PropertyDetails data={data} />
        </Page>
      );
    case 'executive_summary':
      return (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <ExecutiveSummary data={data} />
        </Page>
      );
    case 'maps':
      return <SubjectPhotoExhibit data={data} mode="maps" />;
    case 'photos':
      return <SubjectPhotoExhibit data={data} mode="photos" />;
    case 'assignment_scope':
      return content ? (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <AssignmentAndScope content={content} />
        </Page>
      ) : null;
    case 'narrative':
    case 'assignment_guide':
      return content ? <NarrativeSectionPage section={section} content={content} /> : null;
    case 'condition_table':
      return (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <ConditionSection data={data} />
        </Page>
      );
    case 'comparable_grid':
      return (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <CompsGrid data={data} />
        </Page>
      );
    case 'comparable_profiles':
      return <ComparableSaleProfiles data={data} />;
    case 'income_calculation':
      return (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <IncomeApproachTable data={data} />
        </Page>
      );
    case 'cost_calculation':
      return (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <CostApproachTable data={data} />
        </Page>
      );
    case 'assessment_context':
      return (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <AssessmentRatioAnalysis data={data} />
        </Page>
      );
    case 'reconciliation':
      return (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <AdjustmentReconciliation data={data} />
        </Page>
      );
    case 'filing_guide':
      return data.filingGuide ? (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <FilingGuide guide={data.filingGuide} />
        </Page>
      ) : null;
    case 'certification':
      return content ? (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <CertificationAndLimitingConditions content={content} />
        </Page>
      ) : null;
    case 'disclaimer':
      return (
        <Page size="LETTER" style={theme.page}>
          <PageFooter />
          <Disclaimer data={data} />
        </Page>
      );
  }
}

export default function ReportDocument({ data }: { data: ReportTemplateData }) {
  const plan = buildReportRenderPlan(data);
  const letter = plan.sections.find((section) => section.kind === 'letter');
  const bodySections = plan.sections.filter((section) => section.kind !== 'letter');

  return (
    <Document
      title={`${plan.profile.documentTitle} — ${data.report.property_address}`}
      author="Resourceful"
      subject={plan.profile.documentTitle}
      keywords={`property valuation, ${plan.profile.assignmentKind}, ${data.report.property_type}, ${plan.profile.id}`}
    >
      <CoverPage data={data} />
      {letter && renderSection(letter, data, plan)}
      <TableOfContents data={data} plan={plan} />
      {bodySections.map((section) => (
        <React.Fragment key={section.id}>
          {renderSection(section, data, plan)}
        </React.Fragment>
      ))}
    </Document>
  );
}
