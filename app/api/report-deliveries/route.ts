import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ResendConfigurationError } from '@/lib/integrations/resend/client';
import { sendReviewedReport } from '@/lib/services/report-delivery-service';
import {
  InvalidReportApprovalError,
  ReportApprovalConfigurationError,
} from '@/lib/services/report-approval-service';

const deliveryRequestSchema = z.object({
  approvalToken: z.string().trim().min(1).max(2_000),
  confirmed: z.literal(true),
  filename: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+\.pdf$/),
  parcelId: z.string().trim().min(1).max(100),
  pdfBase64: z.string().trim().min(1).max(12_000_000),
  recipient: z.email(),
  reportId: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(200),
});

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'The request body must be valid JSON.' },
      { status: 400 },
    );
  }

  const parsedRequest = deliveryRequestSchema.safeParse(payload);

  if (!parsedRequest.success) {
    return NextResponse.json(
      { error: 'Confirm a valid reviewed report before sending.' },
      { status: 400 },
    );
  }

  try {
    const result = await sendReviewedReport(parsedRequest.data);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof InvalidReportApprovalError) {
      return NextResponse.json(
        { error: 'This report preview has changed or expired. Generate it again.' },
        { status: 409 },
      );
    }

    if (
      error instanceof ResendConfigurationError ||
      error instanceof ReportApprovalConfigurationError
    ) {
      return NextResponse.json(
        { error: 'Report delivery is not configured on the server.' },
        { status: 503 },
      );
    }

    console.error('Reviewed report delivery failed.', error);

    return NextResponse.json(
      { error: 'The report could not be sent. You can retry or download it.' },
      { status: 502 },
    );
  }
}
