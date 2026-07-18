import { describe, expect, it } from 'vitest';

import {
  AFFECTED_PARCEL_ID,
  getCanonicalDemoScenario,
  getCanonicalDemoState,
  REVIEW_PARCEL_ID,
} from '@/lib/fixtures/canonical-demo-scenario';

describe('canonical demo scenario', () => {
  it('connects the active finding and inspection to existing evidence', () => {
    const scenario = getCanonicalDemoScenario();
    const state = getCanonicalDemoState();
    const finding = scenario.findings.find(
      ({ id }) => id === state.activeFindingId,
    );

    expect(scenario.parcels.features).toHaveLength(24);
    expect(state.schemaVersion).toBe(2);
    expect(state.selectedParcelId).toBe('parcel-herault-01');
    expect(finding).toBeDefined();
    expect(
      scenario.parcels.features.some(
        ({ properties }) => properties.id === finding?.parcelId,
      ),
    ).toBe(true);
    expect(
      scenario.sectors.some(
        ({ properties }) =>
          properties.id === finding?.sectorId &&
          properties.parcelId === finding.parcelId,
      ),
    ).toBe(true);

    const observationIds = new Set(scenario.observations.map(({ id }) => id));
    expect(
      finding?.supportingObservationIds.every((id) => observationIds.has(id)),
    ).toBe(true);
    expect(state.activeInspection.findingId).toBe(finding?.id);
    expect(state.activeInspection.parcelId).toBe(finding?.parcelId);
    expect(state.activeInspection.sectorId).toBe(finding?.sectorId);
    expect(finding?.parcelId).toBe('parcel-herault-06');

    const clusterCounts = Object.groupBy(
      scenario.parcels.features,
      ({ properties }) => properties.cluster,
    );
    expect(
      Object.values(clusterCounts).map((features) => features?.length),
    ).toEqual([6, 6, 6, 6]);
    expect(
      scenario.parcels.features.every(
        ({ properties }) =>
          properties.sourceDataset === 'IGN RPG 2024' &&
          properties.sourceCropCode === 'VRC',
      ),
    ).toBe(true);
    expect(
      new Set(
        scenario.parcels.features.map(({ properties }) => properties.name),
      ).size,
    ).toBe(24);
  });

  it('contains a recovered irrigation cycle followed by an unresolved decline', () => {
    const scenario = getCanonicalDemoScenario();
    const moistureValues = scenario.observations
      .filter(
        (observation) =>
          observation.metric === 'soil-moisture' &&
          observation.sectorId === 'sector-b',
      )
      .map(({ value }) => value);

    const moistureObservations = scenario.observations.filter(
      (observation) => observation.metric === 'soil-moisture',
    );

    expect(moistureObservations).toHaveLength(199);
    expect(moistureObservations.at(0)?.observedAt).toBe('2026-01-01T08:00:00Z');
    expect(moistureObservations.at(-1)?.observedAt).toBe(
      '2026-07-18T08:00:00Z',
    );
    expect(moistureValues.slice(-7)).toEqual([34, 31, 28, 25, 22, 19, 16]);
    expect(scenario.irrigationEvents).toHaveLength(9);
    expect(scenario.irrigationEvents.at(0)?.startedAt).toBe(
      '2026-06-02T18:00:00Z',
    );
    expect(scenario.irrigationEvents.at(-1)).toEqual(
      expect.objectContaining({
        sectorId: 'sector-b',
        startedAt: '2026-07-12T18:00:00Z',
        status: 'completed',
      }),
    );

    const averageForMonth = (month: string) => {
      const values = moistureObservations
        .filter(({ observedAt }) => observedAt.startsWith(`2026-${month}`))
        .map(({ value }) => value);

      return values.reduce((sum, value) => sum + value, 0) / values.length;
    };

    expect(averageForMonth('01')).toBeGreaterThan(averageForMonth('04'));
    expect(averageForMonth('04')).toBeGreaterThan(averageForMonth('07'));

    const rainfallObservations = scenario.observations.filter(
      (observation) => observation.metric === 'rainfall',
    );
    expect(rainfallObservations).toHaveLength(199);
    expect(
      rainfallObservations.some(
        ({ observedAt, value }) =>
          observedAt.startsWith('2026-01') && value > 0,
      ),
    ).toBe(true);
    expect(
      rainfallObservations
        .filter(({ observedAt }) => observedAt >= '2026-07-14T08:00:00Z')
        .every(({ value }) => value === 0),
    ).toBe(true);
  });

  it('exposes exactly one critical parcel and one parcel for review', () => {
    const scenario = getCanonicalDemoScenario();
    const statuses = Object.groupBy(
      scenario.parcels.features,
      ({ properties }) => properties.moistureStatus,
    );
    const reviewParcel = scenario.parcels.features.find(
      ({ properties }) => properties.id === REVIEW_PARCEL_ID,
    );

    expect(statuses.stable).toHaveLength(22);
    expect(statuses.watch).toHaveLength(1);
    expect(statuses.critical).toHaveLength(1);
    expect(reviewParcel?.properties.currentSoilMoisturePercent).toBe(24);
    expect(scenario.reviewSummaries).toEqual([
      expect.objectContaining({
        parcelId: AFFECTED_PARCEL_ID,
        status: 'critical',
        source: 'mistral-morning-review',
        quality: 'simulated',
      }),
      expect.objectContaining({
        parcelId: REVIEW_PARCEL_ID,
        status: 'watch',
        source: 'mistral-morning-review',
        quality: 'simulated',
      }),
    ]);
  });

  it('keeps the active inspection attached only to the critical parcel', () => {
    const state = getCanonicalDemoState();

    expect(state.activeInspection.parcelId).toBe(AFFECTED_PARCEL_ID);
    expect(state.activeInspection.parcelId).not.toBe(REVIEW_PARCEL_ID);
  });

  it('returns defensive copies of fixtures', () => {
    const firstState = getCanonicalDemoState();
    firstState.activeInspection.nextStep = 'Mutated value';

    expect(getCanonicalDemoState().activeInspection.nextStep).toBe(
      'Verify irrigation delivery and capture field evidence.',
    );
  });

  it('derives Sector B from geometry inside the affected parcel', () => {
    const scenario = getCanonicalDemoScenario();
    const affectedParcel = scenario.parcels.features.find(
      ({ properties }) => properties.id === 'parcel-herault-06',
    );
    const sector = scenario.sectors.find(
      ({ properties }) => properties.id === 'sector-b',
    );

    expect(affectedParcel).toBeDefined();
    expect(sector).toBeDefined();

    const parcelCoordinates =
      affectedParcel?.geometry.type === 'Polygon'
        ? affectedParcel.geometry.coordinates.flat(1)
        : (affectedParcel?.geometry.coordinates.flat(2) ?? []);
    const sectorCoordinates = sector?.geometry.coordinates.flat(1) ?? [];
    const longitudes = parcelCoordinates.map(([longitude]) => longitude);
    const latitudes = parcelCoordinates.map(([, latitude]) => latitude);

    expect(
      sectorCoordinates.every(
        ([longitude, latitude]) =>
          longitude >= Math.min(...longitudes) &&
          longitude <= Math.max(...longitudes) &&
          latitude >= Math.min(...latitudes) &&
          latitude <= Math.max(...latitudes),
      ),
    ).toBe(true);
  });
});
