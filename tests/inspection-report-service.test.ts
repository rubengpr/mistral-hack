import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const chatParse = vi.hoisted(() => vi.fn());

vi.mock('@/lib/integrations/mistral/client', () => ({
  createMistralClient: () => ({
    chat: { parse: chatParse },
  }),
}));

import { getCanonicalDemoState } from '@/lib/fixtures/canonical-demo-scenario';
import { generateInspectionReport } from '@/lib/services/inspection-report-service';

describe('inspection report service', () => {
  beforeEach(() => {
    vi.stubEnv('REPORT_APPROVAL_SECRET', 'test-report-approval-secret');
    chatParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              summary:
                'Sector B shows a sustained decline in simulated soil-moisture readings.',
              interpretation:
                'The available evidence is compatible with reduced water delivery and requires field verification.',
              uncertainty:
                'The sensor and weather inputs are simulated demo evidence and do not establish a diagnosis.',
            },
          },
        },
      ],
    });
  });

  afterEach(() => {
    chatParse.mockReset();
    vi.unstubAllEnvs();
  });

  it('generates a signed one-page report artifact from available evidence', async () => {
    const inspection = getCanonicalDemoState().activeInspection;
    const artifact = await generateInspectionReport({
      inspectionHistory: inspection,
      selectedParcelId: inspection.parcelId,
    });
    const pdf = Buffer.from(artifact.pdfBase64, 'base64');
    const pdfSource = pdf.toString('latin1');
    const mediaBox = pdfSource
      .match(/\/MediaBox\s*\[([^\]]+)\]/)?.[1]
      .trim()
      .split(/\s+/)
      .map(Number);

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdfSource.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(mediaBox).toHaveLength(4);
    expect(mediaBox?.[2]).toBeCloseTo(595.28, 1);
    expect(mediaBox?.[3]).toBeCloseTo(841.89, 1);
    expect(pdfSource).toContain('/Subtype /Image');
    expect(artifact).toMatchObject({
      recipient: 'rubengpr@gmail.com',
      sender: 'Vinea <onboarding@resend.dev>',
      status: 'preview-ready',
    });
    expect(artifact.report.evidence.map(({ source }) => source)).toEqual([
      'sensor',
      'weather',
    ]);
    expect(artifact.report.moistureTrend).toHaveLength(5);
    expect(artifact.report.photoDataUrl).toBeUndefined();
    expect(artifact.approvalToken).toContain('.');
  });
});
