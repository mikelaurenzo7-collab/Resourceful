import React from 'react';

interface ValueConclusionRow {
  approach: string;
  total: string;
  perUnit?: string;
}

interface ValueConclusionTableProps {
  rows: ValueConclusionRow[];
  finalValue: string;
  finalValueWords?: string;
  dateOfValue: string;
}

const ValueConclusionTable: React.FC<ValueConclusionTableProps> = ({ rows, finalValue, finalValueWords, dateOfValue }) => (
  <section>
    <h3>Valuation Conclusions</h3>
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
      <thead>
        <tr>
          <th style={{ border: '1px solid #ccc', padding: 4 }}>Approach</th>
          <th style={{ border: '1px solid #ccc', padding: 4 }}>Total</th>
          <th style={{ border: '1px solid #ccc', padding: 4 }}>Per Unit</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={idx}>
            <td style={{ border: '1px solid #ccc', padding: 4 }}>{row.approach}</td>
            <td style={{ border: '1px solid #ccc', padding: 4 }}>{row.total}</td>
            <td style={{ border: '1px solid #ccc', padding: 4 }}>{row.perUnit || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <div><b>Final Value as of {dateOfValue}:</b> {finalValue} {finalValueWords && (<span>({finalValueWords})</span>)}</div>
  </section>
);

export default ValueConclusionTable;
