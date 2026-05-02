import React from 'react';

interface HighestAndBestUseVacantProps {
  legal: string;
  physical: string;
  financial: string;
  maximum: string;
  conclusion: string;
}

const HighestAndBestUseVacant: React.FC<HighestAndBestUseVacantProps> = ({ legal, physical, financial, maximum, conclusion }) => (
  <section>
    <h3>Highest and Best Use As Vacant</h3>
    <p><b>Legally Permissible:</b> {legal}</p>
    <p><b>Physically Possible:</b> {physical}</p>
    <p><b>Financially Feasible:</b> {financial}</p>
    <p><b>Maximally Productive:</b> {maximum}</p>
    <p><b>Conclusion:</b> {conclusion}</p>
  </section>
);

export default HighestAndBestUseVacant;
