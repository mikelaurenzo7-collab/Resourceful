import React from 'react';

interface CapRateSource {
  method: string;
  range: string;
  average: string;
  notes?: string;
}

interface CapRateDerivationProps {
  sources: CapRateSource[];
  concludedRate: string;
  loadedRate?: string;
  calculationNotes?: string;
}

const CapRateDerivation: React.FC<CapRateDerivationProps> = ({ sources, concludedRate, loadedRate, calculationNotes }) => (
  <section>
    <h3>Cap Rate Derivation</h3>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ border: '1px solid #ccc', padding: 4 }}>Method</th>
          <th style={{ border: '1px solid #ccc', padding: 4 }}>Range</th>
          <th style={{ border: '1px solid #ccc', padding: 4 }}>Average</th>
          <th style={{ border: '1px solid #ccc', padding: 4 }}>Notes</th>
        </tr>
      </thead>
      <tbody>
        {sources.map((s, idx) => (
          <tr key={idx}>
            <td style={{ border: '1px solid #ccc', padding: 4 }}>{s.method}</td>
            <td style={{ border: '1px solid #ccc', padding: 4 }}>{s.range}</td>
            <td style={{ border: '1px solid #ccc', padding: 4 }}>{s.average}</td>
            <td style={{ border: '1px solid #ccc', padding: 4 }}>{s.notes || ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <p><b>Concluded Cap Rate:</b> {concludedRate}</p>
    {loadedRate && <p><b>Loaded Cap Rate:</b> {loadedRate}</p>}
    {calculationNotes && <p>{calculationNotes}</p>}
  </section>
);

export default CapRateDerivation;
