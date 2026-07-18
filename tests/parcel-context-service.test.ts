import { describe, expect, it } from 'vitest';

import {
  getSelectedParcelContext,
  ParcelContextNotFoundError,
} from '@/lib/services/parcel-context-service';

describe('parcel context service', () => {
  it('aggregates the canonical alert, sensors, weather, and history', () => {
    const context = getSelectedParcelContext('parcel-herault-06', {
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
      photos: [],
      actions: [],
      nextStep: 'Inspect Sector B.',
    });

    expect(context.parcel.name).toBe('Le Clos de la Rivière');
    expect(context.alerts).toHaveLength(1);
    expect(context.alerts[0]).toMatchObject({
      id: 'finding-soil-moisture-01',
      evidenceQuality: 'simulated',
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
      sourceLabel: 'Simulated demo weather',
      startsOn: '2026-07-14',
      endsOn: '2026-07-18',
      quality: 'simulated',
    });
    expect(context.history.irrigationEvents.length).toBeGreaterThan(0);
    expect(context.history.inspection?.notes[0]?.content).toContain(
      'irrigation line',
    );
  });

  it('returns honest empty alert and inspection history states', () => {
    const context = getSelectedParcelContext('parcel-herault-01');

    expect(context.alerts).toEqual([]);
    expect(context.history.irrigationEvents).toEqual([]);
    expect(context.history.inspection).toBeNull();
    expect(context.weather.daily).toHaveLength(7);
  });

  it('rejects an unknown selected parcel', () => {
    expect(() => getSelectedParcelContext('unknown-parcel')).toThrow(
      ParcelContextNotFoundError,
    );
  });
});
