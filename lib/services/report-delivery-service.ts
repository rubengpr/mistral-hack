import { createResendClient } from '@/lib/integrations/resend/client';
import { getParcelReportRecipient } from '@/lib/fixtures/report-recipient';
import { verifyReportApprovalToken } from '@/lib/services/report-approval-service';
import type { ReportDeliveryResult } from '@/types/inspection-report';

export class ReportDeliveryError extends Error {
  constructor() {
    super('Resend did not accept the report email.');
    this.name = 'ReportDeliveryError';
  }
}

export async function sendReviewedReport(input: {
  approvalToken: string;
  filename: string;
  parcelId: string;
  pdfBase64: string;
  recipient: string;
  reportId: string;
  subject: string;
}): Promise<ReportDeliveryResult> {
  const expectedRecipient = getParcelReportRecipient(input.parcelId);

  if (!expectedRecipient || expectedRecipient.email !== input.recipient) {
    throw new ReportDeliveryError();
  }

  verifyReportApprovalToken({
    approvalToken: input.approvalToken,
    pdfBase64: input.pdfBase64,
    recipient: input.recipient,
    reportId: input.reportId,
  });

  const resend = createResendClient();
  const { data, error } = await resend.emails.send(
    {
      attachments: [
        {
          content: Buffer.from(input.pdfBase64, 'base64'),
          filename: input.filename,
        },
      ],
      from: process.env.RESEND_FROM_EMAIL ?? 'Vinea <onboarding@resend.dev>',
      html: `<p>Attached is the technician-reviewed inspection report for the selected vineyard parcel.</p><p>This report supports field review and is not an official agronomic diagnosis.</p>`,
      subject: input.subject,
      text: 'Attached is the technician-reviewed vineyard inspection report. This report supports field review and is not an official agronomic diagnosis.',
      to: [input.recipient],
    },
    {
      idempotencyKey: `inspection-report/${input.reportId}`,
    },
  );

  if (error || !data?.id) {
    throw new ReportDeliveryError();
  }

  return {
    reportId: input.reportId,
    providerMessageId: data.id,
    recipient: input.recipient,
    sentAt: new Date().toISOString(),
    status: 'sent',
  };
}
