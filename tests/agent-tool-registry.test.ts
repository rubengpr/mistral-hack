import { describe, expect, it, vi } from 'vitest';

const generateInspectionReport = vi.hoisted(() => vi.fn());

vi.mock('@/lib/services/inspection-report-service', () => ({
  generateInspectionReport,
}));

import { getCanonicalDemoState } from '@/lib/fixtures/canonical-demo-scenario';
import {
  AGENT_TOOL_DEFINITIONS,
  executeAgentTool,
} from '@/lib/services/agent-tool-registry';
import type { ReportArtifact } from '@/types/inspection-report';

describe('agent report tool', () => {
  it('exposes report generation to Mistral but never exposes email delivery', () => {
    const names = AGENT_TOOL_DEFINITIONS.map((tool) => tool.function.name);

    expect(names).toContain('generate_inspection_report');
    expect(names).not.toContain('send_reviewed_report');
  });

  it('returns the report artifact as a completed agent action', async () => {
    const artifact = {
      report: { id: 'report-01', parcelName: 'Le Clos de la Rivière' },
      recipient: 'rubengpr@gmail.com',
      status: 'preview-ready',
    } as ReportArtifact;
    const inspection = getCanonicalDemoState().activeInspection;

    generateInspectionReport.mockResolvedValue(artifact);

    const result = await executeAgentTool(
      'generate_inspection_report',
      '{}',
      {
        inspectionHistory: inspection,
        selectedParcelId: inspection.parcelId,
      },
    );

    expect(result.action).toMatchObject({
      artifact,
      name: 'generate_inspection_report',
      status: 'completed',
    });
  });
});
