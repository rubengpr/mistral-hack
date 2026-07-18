import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sendEmail = vi.hoisted(() => vi.fn());

vi.mock('@/lib/integrations/resend/client', () => ({
  createResendClient: () => ({ emails: { send: sendEmail } }),
}));

import { createReportApprovalToken } from '@/lib/services/report-approval-service';
import {
  ReportDeliveryError,
  sendReviewedReport,
} from '@/lib/services/report-delivery-service';
import type { InspectionReport } from '@/types/inspection-report';

describe('report delivery service', () => {
  beforeEach(() => {
    vi.stubEnv('REPORT_APPROVAL_SECRET', 'test-report-approval-secret');
    sendEmail.mockResolvedValue({ data: { id: 'resend-message-01' } });
  });

  afterEach(() => {
    sendEmail.mockReset();
    vi.unstubAllEnvs();
  });

  it('uses the fixed recipient, PDF attachment, and stable idempotency key', async () => {
    const report = { id: 'report-01' } as InspectionReport;
    const pdfBase64 = Buffer.from('%PDF-approved').toString('base64');
    const approvalToken = createReportApprovalToken(
      report,
      'rubengpr@gmail.com',
      pdfBase64,
    );

    await expect(
      sendReviewedReport({
        approvalToken,
        filename: 'vinea-inspection-parcel-herault-06.pdf',
        parcelId: 'parcel-herault-06',
        pdfBase64,
        recipient: 'rubengpr@gmail.com',
        reportId: report.id,
        subject: 'Vinea inspection report',
      }),
    ).resolves.toMatchObject({
      providerMessageId: 'resend-message-01',
      status: 'sent',
    });

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ['rubengpr@gmail.com'],
        attachments: [
          expect.objectContaining({
            filename: 'vinea-inspection-parcel-herault-06.pdf',
          }),
        ],
      }),
      { idempotencyKey: 'inspection-report/report-01' },
    );
  });

  it('rejects a recipient that is not configured for the parcel', async () => {
    await expect(
      sendReviewedReport({
        approvalToken: 'invalid',
        filename: 'report.pdf',
        parcelId: 'parcel-herault-06',
        pdfBase64: Buffer.from('%PDF').toString('base64'),
        recipient: 'other@example.com',
        reportId: 'report-01',
        subject: 'Report',
      }),
    ).rejects.toBeInstanceOf(ReportDeliveryError);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
