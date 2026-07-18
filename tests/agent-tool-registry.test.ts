import { afterEach, describe, expect, it, vi } from 'vitest';

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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exposes report generation to Mistral but never exposes email delivery', () => {
    const names = AGENT_TOOL_DEFINITIONS.map((tool) => tool.function.name);

    expect(names).toContain('generate_inspection_report');
    expect(names).toContain('save_inspection_note');
    expect(names).toContain('get_weather_forecast');
    expect(names).not.toContain('send_reviewed_report');
  });

  it('retrieves a parcel forecast without changing irrigation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));

    const result = await executeAgentTool(
      'get_weather_forecast',
      JSON.stringify({ scope: 'parcel' }),
      { selectedParcelId: 'parcel-gard-01' },
    );
    const content = JSON.parse(result.content);

    expect(result.action).toMatchObject({
      name: 'get_weather_forecast',
      status: 'completed',
    });
    expect(content).toMatchObject({
      success: true,
      data: {
        source: 'fixture',
        forecast: { daily: expect.any(Array) },
      },
    });
  });

  it('prepares a structured note without claiming browser persistence', async () => {
    const inspection = getCanonicalDemoState().activeInspection;
    const result = await executeAgentTool(
      'save_inspection_note',
      JSON.stringify({
        scope: 'parcel',
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
      label: 'Parcel note ready',
      status: 'completed',
      targetParcelIds: [inspection.parcelId],
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

  it('prepares a note for the selected parcel without an active inspection', async () => {
    const result = await executeAgentTool(
      'save_inspection_note',
      JSON.stringify({
        scope: 'parcel',
        observation: 'Localized symptoms.',
        assessment: 'Limited impact.',
        uncertainty: 'Cause unconfirmed.',
        nextStep: 'Reinspect the parcel.',
      }),
      { selectedParcelId: 'parcel-gard-06' },
    );

    expect(result.action).toMatchObject({
      name: 'save_inspection_note',
      targetParcelIds: ['parcel-gard-06'],
    });
    expect(JSON.parse(result.content)).toMatchObject({
      success: true,
      data: { status: 'ready-for-browser-persistence' },
    });
  });

  it('targets every parcel in a requested cluster', async () => {
    const result = await executeAgentTool(
      'save_inspection_note',
      JSON.stringify({
        scope: 'cluster',
        cluster: 'gard',
        observation: 'The Gard parcels require an irrigation plan update.',
        assessment: 'The current plan may not cover forecast demand.',
        uncertainty: 'Field demand must still be monitored.',
        nextStep: 'Increase irrigation volume by 25% for the Gard parcels.',
      }),
      { selectedParcelId: 'parcel-gard-06' },
    );

    expect(result.action).toMatchObject({
      name: 'save_inspection_note',
      label: 'Parcel note ready · 6 parcels',
      targetParcelIds: [
        'parcel-gard-01',
        'parcel-gard-02',
        'parcel-gard-03',
        'parcel-gard-04',
        'parcel-gard-05',
        'parcel-gard-06',
      ],
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

    const result = await executeAgentTool('generate_inspection_report', '{}', {
      inspectionHistory: inspection,
      selectedParcelId: inspection.parcelId,
    });

    expect(result.action).toMatchObject({
      artifact,
      name: 'generate_inspection_report',
      status: 'completed',
    });
  });
});
