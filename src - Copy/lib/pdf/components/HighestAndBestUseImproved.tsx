import React from 'react';

interface HighestAndBestUseImprovedProps {
  legal: string;
  physical: string;
  financial: string;
  conclusion: string;
}

const HighestAndBestUseImproved: React.FC<HighestAndBestUseImprovedProps> = ({ legal, physical, financial, conclusion }) => (
  <section>
    <h3>Highest and Best Use As Improved</h3>
    <p><b>Legally Permissible:</b> {legal}</p>
    <p><b>Physically Possible:</b> {physical}</p>
    <p><b>Financially Feasible and Maximally Productive:</b> {financial}</p>
    <p><b>Conclusion:</b> {conclusion}</p>
  </section>
);

export default HighestAndBestUseImproved;
