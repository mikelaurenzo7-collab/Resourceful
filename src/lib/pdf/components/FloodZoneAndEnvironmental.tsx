import React from 'react';

interface FloodZoneAndEnvironmentalProps {
  femaPanel: string;
  floodZone: string;
  environmentalNotes: string;
}

const FloodZoneAndEnvironmental: React.FC<FloodZoneAndEnvironmentalProps> = ({ femaPanel, floodZone, environmentalNotes }) => (
  <section>
    <h3>Flood Zone & Environmental</h3>
    <p><b>FEMA Panel:</b> {femaPanel}</p>
    <p><b>Flood Zone:</b> {floodZone}</p>
    <p>{environmentalNotes}</p>
  </section>
);

export default FloodZoneAndEnvironmental;
