import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

import type { InspectionReport } from '@/types/inspection-report';

const APPROVAL_LIFETIME_MILLISECONDS = 30 * 60 * 1000;

type ApprovalPayload = {
  expiresAt: string;
  pdfHash: string;
  recipient: string;
  reportId: string;
};

export class ReportApprovalConfigurationError extends Error {
  constructor() {
    super('Report approval signing is not configured.');
    this.name = 'ReportApprovalConfigurationError';
  }
}

export class InvalidReportApprovalError extends Error {
  constructor() {
    super('The report approval is invalid or has expired.');
    this.name = 'InvalidReportApprovalError';
  }
}

function getApprovalSecret() {
  const secret = process.env.REPORT_APPROVAL_SECRET;

  if (!secret) {
    throw new ReportApprovalConfigurationError();
  }

  return secret;
}

function hashPdf(pdfBase64: string) {
  return createHash('sha256')
    .update(Buffer.from(pdfBase64, 'base64'))
    .digest('hex');
}

function sign(encodedPayload: string) {
  return createHmac('sha256', getApprovalSecret())
    .update(encodedPayload)
    .digest('base64url');
}

export function createReportApprovalToken(
  report: InspectionReport,
  recipient: string,
  pdfBase64: string,
) {
  const payload: ApprovalPayload = {
    expiresAt: new Date(
      Date.now() + APPROVAL_LIFETIME_MILLISECONDS,
    ).toISOString(),
    pdfHash: hashPdf(pdfBase64),
    recipient,
    reportId: report.id,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  );

  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyReportApprovalToken(input: {
  approvalToken: string;
  pdfBase64: string;
  recipient: string;
  reportId: string;
}) {
  const [encodedPayload, providedSignature] = input.approvalToken.split('.');

  if (!encodedPayload || !providedSignature) {
    throw new InvalidReportApprovalError();
  }

  const expectedSignature = sign(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    throw new InvalidReportApprovalError();
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as ApprovalPayload;

    if (
      payload.reportId !== input.reportId ||
      payload.recipient !== input.recipient ||
      payload.pdfHash !== hashPdf(input.pdfBase64) ||
      Date.parse(payload.expiresAt) <= Date.now()
    ) {
      throw new InvalidReportApprovalError();
    }

    return payload;
  } catch (error) {
    if (error instanceof InvalidReportApprovalError) {
      throw error;
    }

    throw new InvalidReportApprovalError();
  }
}
