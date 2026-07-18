import {
  hashPdfBuffer,
  type ReportArtifactManifest,
} from './report-artifact-manifest';

export type ReportArtifactVerificationCode =
  | 'REPORT_ARTIFACT_VERIFIED'
  | 'PDF_PATH_INVALID'
  | 'MANIFEST_JSON_INVALID'
  | 'MANIFEST_SCHEMA_UNSUPPORTED'
  | 'REPORT_ID_MISMATCH'
  | 'REPORT_CONTRACT_MISMATCH'
  | 'ARTIFACT_PATH_MISMATCH'
  | 'ARTIFACT_BYTE_LENGTH_MISMATCH'
  | 'ARTIFACT_HASH_MISMATCH'
  | 'JURISDICTION_RELEASE_NOT_READY';

export type ReportArtifactVerificationResult =
  | {
      verified: true;
      code: 'REPORT_ARTIFACT_VERIFIED';
      message: string;
      manifest: ReportArtifactManifest;
    }
  | {
      verified: false;
      code: Exclude<ReportArtifactVerificationCode, 'REPORT_ARTIFACT_VERIFIED'>;
      message: string;
      manifest: ReportArtifactManifest | null;
    };

export function manifestPathForPdf(pdfPath: string): string {
  const normalized = pdfPath.trim();
  if (!normalized || !normalized.endsWith('.pdf')) {
    throw new Error('Report PDF path must be a non-empty .pdf storage path');
  }
  return `${normalized.slice(0, -4)}.manifest.json`;
}

export function releaseKeyForPdfPath(pdfPath: string): string {
  manifestPathForPdf(pdfPath);
  const filename = pdfPath.trim().split('/').pop();
  const releaseKey = filename?.slice(0, -4);
  if (!releaseKey || !/^[a-zA-Z0-9_-]+$/.test(releaseKey)) {
    throw new Error('Report PDF filename does not contain a safe immutable release key');
  }
  return releaseKey;
}

function isManifest(value: unknown): value is ReportArtifactManifest {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as Partial<ReportArtifactManifest>;
  return Boolean(
    typeof manifest.schemaVersion === 'string' &&
    typeof manifest.rendererVersion === 'string' &&
    manifest.report &&
    typeof manifest.report.id === 'string' &&
    manifest.artifact &&
    typeof manifest.artifact.sha256 === 'string' &&
    typeof manifest.artifact.bytes === 'number' &&
    typeof manifest.artifact.pdfPath === 'string' &&
    typeof manifest.artifact.manifestPath === 'string' &&
    manifest.jurisdiction &&
    typeof manifest.jurisdiction.releaseReady === 'boolean'
  );
}

function schemaParts(schemaVersion: string): { major: number; minor: number } | null {
  const [majorText, minorText] = schemaVersion.split('.');
  const major = Number(majorText);
  const minor = Number(minorText);
  if (!Number.isInteger(major) || !Number.isInteger(minor) || major < 0 || minor < 0) {
    return null;
  }
  return { major, minor };
}

function hasSchema13Provenance(manifest: ReportArtifactManifest): boolean {
  const jurisdiction = manifest.jurisdiction as Partial<ReportArtifactManifest['jurisdiction']>;
  const evidence = manifest.evidence as Partial<ReportArtifactManifest['evidence']> | undefined;
  const pluginKeyValid =
    jurisdiction.pluginKey === null || typeof jurisdiction.pluginKey === 'string';
  const pluginVersionValid =
    jurisdiction.pluginVersion === null || typeof jurisdiction.pluginVersion === 'number';

  return Boolean(
    evidence &&
    typeof evidence.costApproachReleaseReady === 'boolean' &&
    typeof jurisdiction.classificationSourceVerified === 'boolean' &&
    pluginKeyValid &&
    pluginVersionValid
  );
}

export function verifyReportArtifact(input: {
  reportId: string;
  serviceType: string;
  propertyType: string;
  reviewTier: string;
  pdfPath: string;
  pdfBuffer: Buffer;
  manifestJson: string;
}): ReportArtifactVerificationResult {
  let expectedManifestPath: string;
  try {
    expectedManifestPath = manifestPathForPdf(input.pdfPath);
    releaseKeyForPdfPath(input.pdfPath);
  } catch (error) {
    return {
      verified: false,
      code: 'PDF_PATH_INVALID',
      message: error instanceof Error ? error.message : String(error),
      manifest: null,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.manifestJson);
  } catch {
    return {
      verified: false,
      code: 'MANIFEST_JSON_INVALID',
      message: 'The report manifest is not valid JSON.',
      manifest: null,
    };
  }

  if (!isManifest(parsed)) {
    return {
      verified: false,
      code: 'MANIFEST_JSON_INVALID',
      message: 'The report manifest is missing required structural fields.',
      manifest: null,
    };
  }

  const manifest = parsed;
  const schema = schemaParts(manifest.schemaVersion);
  if (!schema || schema.major !== 1) {
    return {
      verified: false,
      code: 'MANIFEST_SCHEMA_UNSUPPORTED',
      message: `Unsupported report manifest schema version '${manifest.schemaVersion}'.`,
      manifest,
    };
  }

  if (schema.minor >= 3 && !hasSchema13Provenance(manifest)) {
    return {
      verified: false,
      code: 'MANIFEST_JSON_INVALID',
      message: 'The report manifest is missing required schema 1.3 provenance fields.',
      manifest: null,
    };
  }

  if (manifest.report.id !== input.reportId) {
    return {
      verified: false,
      code: 'REPORT_ID_MISMATCH',
      message: 'The report manifest belongs to a different report.',
      manifest,
    };
  }

  if (
    manifest.report.serviceType !== input.serviceType ||
    manifest.report.propertyType !== input.propertyType ||
    manifest.report.reviewTier !== input.reviewTier
  ) {
    return {
      verified: false,
      code: 'REPORT_CONTRACT_MISMATCH',
      message: 'The report manifest does not match the current service, property, or review-tier contract.',
      manifest,
    };
  }

  if (
    manifest.artifact.pdfPath !== input.pdfPath ||
    manifest.artifact.manifestPath !== expectedManifestPath
  ) {
    return {
      verified: false,
      code: 'ARTIFACT_PATH_MISMATCH',
      message: 'The report artifact paths do not match their manifest.',
      manifest,
    };
  }

  if (manifest.artifact.bytes !== input.pdfBuffer.byteLength) {
    return {
      verified: false,
      code: 'ARTIFACT_BYTE_LENGTH_MISMATCH',
      message: 'The stored PDF byte length does not match its manifest.',
      manifest,
    };
  }

  if (manifest.artifact.sha256 !== hashPdfBuffer(input.pdfBuffer)) {
    return {
      verified: false,
      code: 'ARTIFACT_HASH_MISMATCH',
      message: 'The stored PDF hash does not match its manifest.',
      manifest,
    };
  }

  if (manifest.jurisdiction.releaseReady !== true) {
    return {
      verified: false,
      code: 'JURISDICTION_RELEASE_NOT_READY',
      message: 'The report manifest does not record a release-ready jurisdiction decision.',
      manifest,
    };
  }

  return {
    verified: true,
    code: 'REPORT_ARTIFACT_VERIFIED',
    message: 'The report PDF and manifest are internally consistent and release-ready.',
    manifest,
  };
}
