import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getSelectedParcelContext,
  ParcelContextNotFoundError,
} from '@/lib/services/parcel-context-service';

describe('parcel context service', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('aggregates the canonical alert, sensors, weather, and history', async () => {
    const context = await getSelectedParcelContext('parcel-herault-06', {
      id: 'inspection-test',
      findingId: 'finding-soil-moisture-01',
      parcelId: 'parcel-herault-06',
      sectorId: 'sector-riverbend-b',
      status: 'in-progress',
      conversation: [],
      notes: [
        {
          id: 'note-test',
          content: 'The irrigation line needs inspection.',
          createdAt: '2026-07-18T10:00:00Z',
        },
      ],
      photos: [
        {
          id: 'photo-test',
          dataUrl: 'data:image/jpeg;base64,/9j/',
          capturedAt: '2026-07-18T10:05:00Z',
          analysis: {
            observation: 'Leaf edges appear curled.',
            inference: 'The signs may be compatible with water stress.',
            uncertainty: 'One photograph cannot confirm the cause.',
            recommendedVerification: 'Check soil moisture in the row.',
          },
        },
      ],
      actions: [],
      nextStep: 'Inspect Sector B.',
    });

    expect(context.parcel.name).toBe('Le Clos de la Rivière');
    expect(context.alerts).toHaveLength(1);
    expect(context.alerts[0]).toMatchObject({
      id: 'finding-soil-moisture-01',
      evidenceQuality: 'simulated',
      comparison: {
        affectedSectorMoisturePercent: 16,
        referenceSectorMoisturePercent: 29,
        inference: expect.stringContaining('field verification'),
      },
    });
    expect(context.sensors.items.length).toBeGreaterThan(0);
    expect(context.sensors.items[0]).toEqual(
      expect.objectContaining({
        observedAt: expect.any(String),
        quality: 'simulated',
        confidence: expect.any(Number),
      }),
    );
    expect(context.weather).toMatchObject({
      sourceLabel: 'Simulated demo forecast',
      startsOn: '2026-07-18',
      endsOn: '2026-07-24',
      quality: 'simulated',
    });
    expect(context.history.irrigationEvents.length).toBeGreaterThan(0);
    expect(context.history.inspection?.notes[0]?.content).toContain(
      'irrigation line',
    );
    expect(context.history.inspection?.photos[0]).toMatchObject({
      id: 'photo-test',
      analysis: { observation: 'Leaf edges appear curled.' },
    });
    expect(context.history.inspection?.photos[0]).not.toHaveProperty('dataUrl');
  });

  it('returns honest empty alert and inspection history states', async () => {
    const context = await getSelectedParcelContext('parcel-herault-01');

    expect(context.alerts).toEqual([]);
    expect(context.history.irrigationEvents).toEqual([]);
    expect(context.history.inspection).toBeNull();
    expect(context.weather.daily).toHaveLength(7);
  });

  it('rejects an unknown selected parcel', async () => {
    await expect(getSelectedParcelContext('unknown-parcel')).rejects.toThrow(
      ParcelContextNotFoundError,
    );
  });
});
