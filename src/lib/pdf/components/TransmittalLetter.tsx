import React from 'react';

interface TransmittalLetterProps {
  clientName: string;
  clientContact: string;
  propertyAddress: string;
  pin: string;
  valuationDate: string;
  reportDate: string;
  valueConclusion: string;
  appraiserName: string;
  appraiserLicense: string;
  licenseExpiration: string;
}

const TransmittalLetter: React.FC<TransmittalLetterProps> = ({
  clientName,
  clientContact,
  propertyAddress,
  pin,
  valuationDate,
  reportDate,
  valueConclusion,
  appraiserName,
  appraiserLicense,
  licenseExpiration,
}) => (
  <div style={{ pageBreakAfter: 'always' }}>
    <div style={{ textAlign: 'right' }}>{reportDate}</div>
    <p>Prepared For:</p>
    <p>{clientName}<br />{clientContact}</p>
    <p><b>Re:</b> {propertyAddress}<br />PIN: {pin}</p>
    <p>Dear {clientName.split(' ')[0]},</p>
    <p>
      We are pleased to transmit this Appraisal Report representing our opinion of the market value of the Fee Simple interest for the property at the above-referenced address for the stated purpose. The subject was inspected and a thorough investigation and analysis have been made to arrive at a sound opinion of its market value.
    </p>
    <p>
      As a result of our analysis, we have formed an opinion that the market value, subject to the definitions, certifications, and limiting conditions set forth in the attached report, as of {valuationDate}, was:
    </p>
    <h2 style={{ textAlign: 'center' }}>{valueConclusion}</h2>
    <p style={{ fontStyle: 'italic', textAlign: 'center' }}>
      THIS LETTER MUST REMAIN ATTACHED TO THE REPORT IN ORDER FOR THE VALUE OPINION SET FORTH TO BE CONSIDERED VALID.
    </p>
    <p>
      We appreciate the opportunity to assist you on this project. Please contact us with any questions or comments.
    </p>
    <div style={{ marginTop: '2em' }}>
      <div>{appraiserName}</div>
      <div>License: {appraiserLicense}</div>
      <div>Expires: {licenseExpiration}</div>
    </div>
  </div>
);

export default TransmittalLetter;
