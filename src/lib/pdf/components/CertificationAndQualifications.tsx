import React from 'react';

interface CertificationAndQualificationsProps {
  contingentConditions: string[];
  certificationStatements: string[];
  appraiserName: string;
  appraiserBio: string;
  appraiserLicense: string;
  licenseExpiration: string;
  memberships?: string[];
}

const CertificationAndQualifications: React.FC<CertificationAndQualificationsProps> = ({
  contingentConditions,
  certificationStatements,
  appraiserName,
  appraiserBio,
  appraiserLicense,
  licenseExpiration,
  memberships = [],
}) => (
  <section>
    <h3>Contingent Conditions</h3>
    <ul>
      {contingentConditions.map((cond, idx) => <li key={idx}>{cond}</li>)}
    </ul>
    <h3>Certification</h3>
    <ul>
      {certificationStatements.map((stmt, idx) => <li key={idx}>{stmt}</li>)}
    </ul>
    <h3>Appraiser Qualifications</h3>
    <p><b>{appraiserName}</b></p>
    <p>{appraiserBio}</p>
    <p>License: {appraiserLicense} (Expires: {licenseExpiration})</p>
    {memberships.length > 0 && (
      <div>
        <b>Memberships:</b>
        <ul>
          {memberships.map((m, idx) => <li key={idx}>{m}</li>)}
        </ul>
      </div>
    )}
  </section>
);

export default CertificationAndQualifications;
