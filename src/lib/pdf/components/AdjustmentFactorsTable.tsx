import React from 'react';

interface AdjustmentFactor {
  factor: string;
  explanation: string;
  applicability: string;
}

interface AdjustmentFactorsTableProps {
  factors: AdjustmentFactor[];
}

const AdjustmentFactorsTable: React.FC<AdjustmentFactorsTableProps> = ({ factors }) => (
  <section>
    <h3>Sales Comparison Adjustment Factors</h3>
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr>
          <th style={{ border: '1px solid #ccc', padding: 4 }}>Factor</th>
          <th style={{ border: '1px solid #ccc', padding: 4 }}>Explanation</th>
          <th style={{ border: '1px solid #ccc', padding: 4 }}>Applicability</th>
        </tr>
      </thead>
      <tbody>
        {factors.map((f, idx) => (
          <tr key={idx}>
            <td style={{ border: '1px solid #ccc', padding: 4 }}>{f.factor}</td>
            <td style={{ border: '1px solid #ccc', padding: 4 }}>{f.explanation}</td>
            <td style={{ border: '1px solid #ccc', padding: 4 }}>{f.applicability}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </section>
);

export default AdjustmentFactorsTable;
