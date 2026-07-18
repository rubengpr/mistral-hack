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
    expect(names).toContain('save_inspection_note');
    expect(names).not.toContain('send_reviewed_report');
  });

  it('prepares a structured note without claiming browser persistence', async () => {
    const inspection = getCanonicalDemoState().activeInspection;
    const result = await executeAgentTool(
      'save_inspection_note',
      JSON.stringify({
        observation: 'Mild symptoms are localized in Sector B.',
        assessment: 'The issue appears limited and was identified early.',
        uncertainty: 'The available evidence does not confirm disease.',
        completedAction: '',
        nextStep: 'Prune affected shoots and reinspect adjacent rows.',
      }),
      {
        inspectionHistory: inspection,
        selectedParcelId: inspection.parcelId,
      },
    );

    expect(result.action).toMatchObject({
      name: 'save_inspection_note',
      label: 'Inspection note ready',
      status: 'completed',
      draft: {
        observation: 'Mild symptoms are localized in Sector B.',
        nextStep: 'Prune affected shoots and reinspect adjacent rows.',
      },
    });
    expect(JSON.parse(result.content)).toMatchObject({
      success: true,
      data: { status: 'ready-for-browser-persistence' },
    });
  });

  it('rejects note preparation for a different selected parcel', async () => {
    const inspection = getCanonicalDemoState().activeInspection;
    const result = await executeAgentTool(
      'save_inspection_note',
      JSON.stringify({
        observation: 'Localized symptoms.',
        assessment: 'Limited impact.',
        uncertainty: 'Cause unconfirmed.',
        nextStep: 'Reinspect the parcel.',
      }),
      {
        inspectionHistory: inspection,
        selectedParcelId: 'parcel-herault-01',
      },
    );

    expect(result.action).toBeUndefined();
    expect(JSON.parse(result.content)).toEqual({
      success: false,
      error: 'The inspection note could not be prepared.',
    });
  });

  it('returns the report artifact as a completed agent action', async () => {
    const artifact = {
      report: { id: 'report-01', parcelName: 'Le Clos de la Rivière' },
      recipient: 'rubengpr@gmail.com',
      status: 'preview-ready',
    } as ReportArtifact;
    const inspection = getCanonicalDemoState().activeInspection;
    inspection.status = 'ready-for-review';

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
