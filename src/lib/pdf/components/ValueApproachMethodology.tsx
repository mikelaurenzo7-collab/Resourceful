import React from 'react';

interface ValueApproachMethodologyProps {
  costApproachUsed: boolean;
  costApproachReason?: string;
  salesComparisonSummary: string;
  incomeApproachSummary: string;
}

const ValueApproachMethodology: React.FC<ValueApproachMethodologyProps> = ({
  costApproachUsed,
  costApproachReason,
  salesComparisonSummary,
  incomeApproachSummary,
}) => (
  <section>
    <h3>Approaches to Value: Methodology</h3>
    <h4>Cost Approach</h4>
    {costApproachUsed ? (
      <p>The Cost Approach was applied as follows: {costApproachReason}</p>
    ) : (
      <p>The Cost Approach was considered but omitted due to: {costApproachReason}</p>
    )}
    <h4>Sales Comparison Approach</h4>
    <p>{salesComparisonSummary}</p>
    <h4>Income Capitalization Approach</h4>
    <p>{incomeApproachSummary}</p>
  </section>
);

export default ValueApproachMethodology;
