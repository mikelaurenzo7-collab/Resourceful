import React from 'react';

interface MarketingTimeProps {
  estimate: string;
  rationale: string;
}

const MarketingTime: React.FC<MarketingTimeProps> = ({ estimate, rationale }) => (
  <section>
    <h3>Marketing Time</h3>
    <p><b>Estimated Marketing Time:</b> {estimate}</p>
    <p>{rationale}</p>
  </section>
);

export default MarketingTime;
