import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createReportApprovalToken,
  InvalidReportApprovalError,
  verifyReportApprovalToken,
} from '@/lib/services/report-approval-service';
import type { InspectionReport } from '@/types/inspection-report';

const report = {
  id: 'report-01',
} as InspectionReport;

describe('report approval service', () => {
  beforeEach(() => {
    vi.stubEnv('REPORT_APPROVAL_SECRET', 'test-report-approval-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('accepts the exact approved PDF and recipient', () => {
    const pdfBase64 = Buffer.from('%PDF-approved').toString('base64');
    const approvalToken = createReportApprovalToken(
      report,
      'rubengpr@gmail.com',
      pdfBase64,
    );

    expect(
      verifyReportApprovalToken({
        approvalToken,
        pdfBase64,
        recipient: 'rubengpr@gmail.com',
        reportId: report.id,
      }),
    ).toMatchObject({
      recipient: 'rubengpr@gmail.com',
      reportId: report.id,
    });
  });

  it('rejects modified PDF content or recipient', () => {
    const pdfBase64 = Buffer.from('%PDF-approved').toString('base64');
    const approvalToken = createReportApprovalToken(
      report,
      'rubengpr@gmail.com',
      pdfBase64,
    );

    expect(() =>
      verifyReportApprovalToken({
        approvalToken,
        pdfBase64: Buffer.from('%PDF-modified').toString('base64'),
        recipient: 'rubengpr@gmail.com',
        reportId: report.id,
      }),
    ).toThrow(InvalidReportApprovalError);

    expect(() =>
      verifyReportApprovalToken({
        approvalToken,
        pdfBase64,
        recipient: 'other@example.com',
        reportId: report.id,
      }),
    ).toThrow(InvalidReportApprovalError);
  });
});
