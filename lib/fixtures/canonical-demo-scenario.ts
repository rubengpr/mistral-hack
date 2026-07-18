import type {
  FeatureCollection,
  MultiPolygon,
  Polygon,
  Position,
} from 'geojson';

import vineyardParcels from '@/lib/fixtures/vineyard-parcels.json';
import { createSeasonalMoistureSeries } from '@/lib/fixtures/seasonal-moisture-series';
import type {
  DemoScenario,
  DemoState,
  EvidenceObservation,
  ParcelCluster,
  ParcelFeature,
  ParcelGeometry,
  ParcelMoistureStatus,
  SoilMoistureObservation,
} from '@/types/agricultural-operations';

export const AFFECTED_PARCEL_ID = 'parcel-herault-06';
export const AFFECTED_SECTOR_ID = 'sector-b';
export const ACTIVE_FINDING_ID = 'finding-soil-moisture-01';

const INITIAL_PARCEL_ID = 'parcel-herault-01';
const WATCH_PARCEL_IDS = new Set([
  'parcel-herault-04',
  'parcel-aude-05',
  'parcel-gard-03',
  'parcel-pyrenees-orientales-04',
]);
const PARCEL_NAMES = [
  'Les Terrasses du Soleil',
  'Le Clos des Oliviers',
  'La Combe Rouge',
  'Les Pierres Blanches',
  'Le Plateau des Moulins',
  'Le Clos de la Rivière',
  'Les Vents des Corbières',
  'La Garrigue Haute',
  'Le Chemin des Cyprès',
  "Les Collines d'Ambre",
  'La Porte du Midi',
  'Les Vignes du Canal',
  'Les Galets du Rhône',
  'La Costière Dorée',
  'Le Bois des Pins',
  'Le Mas du Levant',
  'Les Hautes Pierres',
  'La Plaine des Genêts',
  'Les Terrasses Catalanes',
  'Le Clos de la Tramontane',
  'Les Schistes Noirs',
  'La Côte Vermeille',
  'Le Champ des Grenadiers',
  'Le Soleil du Roussillon',
] as const;

type SourceParcelProperties = {
  id: string;
  sourceParcelId: string;
  sourceDataset: 'IGN RPG 2024';
  sourceCropCode: 'VRC';
  name: string;
  cluster: ParcelCluster;
  municipality: string;
  municipalityInseeCode: string;
  department: string;
  departmentCode: string;
  crop: string;
  areaHectares: number;
  demoRole: 'affected-candidate' | 'portfolio';
};

const sourceParcels = vineyardParcels as FeatureCollection<
  ParcelGeometry,
  SourceParcelProperties
>;

function moistureStatus(parcelId: string): ParcelMoistureStatus {
  if (parcelId === AFFECTED_PARCEL_ID) {
    return 'critical';
  }

  return WATCH_PARCEL_IDS.has(parcelId) ? 'watch' : 'stable';
}

function currentMoisture(parcelId: string, index: number) {
  if (parcelId === AFFECTED_PARCEL_ID) {
    return 16;
  }

  return 29 + ((index * 3) % 8);
}

const parcels: ParcelFeature[] = sourceParcels.features.map(
  ({ geometry, properties }, index) => ({
    type: 'Feature',
    id: properties.id,
    geometry,
    properties: {
      id: properties.id,
      sourceParcelId: properties.sourceParcelId,
      sourceDataset: properties.sourceDataset,
      sourceCropCode: properties.sourceCropCode,
      name: PARCEL_NAMES[index] ?? properties.name,
      cluster: properties.cluster,
      municipality: properties.municipality,
      municipalityInseeCode: properties.municipalityInseeCode,
      department: properties.department,
      departmentCode: properties.departmentCode,
      crop: properties.crop,
      areaHectares: properties.areaHectares,
      currentSoilMoisturePercent: currentMoisture(properties.id, index),
      moistureStatus: moistureStatus(properties.id),
      lastReviewedAt: `2026-07-${String(17 - (index % 4)).padStart(2, '0')}T08:00:00Z`,
      sectorCount: 2 + (index % 3),
    },
  }),
);

function ringArea(ring: Position[]) {
  let area = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    area +=
      ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  }

  return Math.abs(area / 2);
}

function largestOuterRing(geometry: Polygon | MultiPolygon): Position[] {
  const rings =
    geometry.type === 'Polygon'
      ? [geometry.coordinates[0]]
      : geometry.coordinates.map((polygon) => polygon[0]);

  return rings.toSorted((left, right) => ringArea(right) - ringArea(left))[0];
}

function ringCentroid(ring: Position[]): [number, number] {
  const openRing = ring.slice(0, -1);
  const longitude =
    openRing.reduce((total, coordinate) => total + coordinate[0], 0) /
    openRing.length;
  const latitude =
    openRing.reduce((total, coordinate) => total + coordinate[1], 0) /
    openRing.length;

  return [longitude, latitude];
}

function createAffectedSectorGeometry(): Polygon {
  const affectedParcel = parcels.find(
    ({ properties }) => properties.id === AFFECTED_PARCEL_ID,
  );

  if (!affectedParcel) {
    throw new Error(`Missing canonical parcel ${AFFECTED_PARCEL_ID}`);
  }

  const outerRing = largestOuterRing(affectedParcel.geometry);
  const [centroidLongitude, centroidLatitude] = ringCentroid(outerRing);
  const scale = 0.42;
  const scaledRing = outerRing.map(([longitude, latitude]) => [
    centroidLongitude + (longitude - centroidLongitude) * scale,
    centroidLatitude + (latitude - centroidLatitude) * scale,
  ]);

  return { type: 'Polygon', coordinates: [scaledRing] };
}

function moistureObservation(
  timestamp: string,
  value: number,
): SoilMoistureObservation {
  const date = timestamp.slice(0, 10);

  return {
    id: `moisture-${AFFECTED_PARCEL_ID}-${date}`,
    source: 'soil-moisture-sensor',
    observedAt: timestamp,
    parcelId: AFFECTED_PARCEL_ID,
    sectorId: AFFECTED_SECTOR_ID,
    metric: 'soil-moisture',
    value,
    unit: 'percent',
    quality: 'simulated',
    confidence: 0.98,
    rawReference: `fixture://soil-moisture/${AFFECTED_PARCEL_ID}/${date}`,
  };
}

const seasonalMoistureSeries = createSeasonalMoistureSeries();
const soilMoistureObservations = seasonalMoistureSeries.map(
  ({ timestamp, value }) => moistureObservation(timestamp, value),
);

const irrigationEvents = seasonalMoistureSeries
  .filter(({ irrigationApplied }) => irrigationApplied)
  .map(({ timestamp }) => ({
    id: `irrigation-${AFFECTED_PARCEL_ID}-${timestamp.slice(0, 10)}`,
    parcelId: AFFECTED_PARCEL_ID,
    sectorId: AFFECTED_SECTOR_ID,
    startedAt: `${timestamp.slice(0, 10)}T18:00:00Z`,
    durationMinutes: 90,
    status: 'completed' as const,
    quality: 'simulated' as const,
  }));

const weatherObservations: EvidenceObservation[] = seasonalMoistureSeries.map(
  ({ timestamp, rainfallMillimeters }) => {
    const date = timestamp.slice(0, 10);

    return {
      id: `rainfall-weather-station-${date}`,
      source: 'weather-station',
      observedAt: timestamp,
      parcelId: AFFECTED_PARCEL_ID,
      sectorId: AFFECTED_SECTOR_ID,
      metric: 'rainfall',
      value: rainfallMillimeters,
      unit: 'millimeters',
      quality: 'simulated',
      confidence: 0.97,
      rawReference: `fixture://weather/${AFFECTED_PARCEL_ID}/${date}`,
    };
  },
);

const canonicalScenario: DemoScenario = {
  portfolioName: 'Occitanie Vineyard Portfolio',
  reviewStartedAt: '2026-07-18T08:00:00Z',
  parcels: {
    type: 'FeatureCollection',
    features: parcels,
  },
  sectors: [
    {
      type: 'Feature',
      properties: {
        id: AFFECTED_SECTOR_ID,
        name: 'Sector B',
        parcelId: AFFECTED_PARCEL_ID,
      },
      geometry: createAffectedSectorGeometry(),
    },
  ],
  observations: [...soilMoistureObservations, ...weatherObservations],
  irrigationEvents,
  findings: [
    {
      id: ACTIVE_FINDING_ID,
      type: 'soil-moisture-drop',
      title: 'Unexpected soil-moisture decline',
      summary:
        'Sector B has continued to dry beyond its normal irrigation cycle. No recovery was detected this morning.',
      severity: 'high',
      status: 'open',
      parcelId: AFFECTED_PARCEL_ID,
      sectorId: AFFECTED_SECTOR_ID,
      detectedAt: '2026-07-18T08:00:00Z',
      timeWindow: {
        startsAt: '2026-07-14T08:00:00Z',
        endsAt: '2026-07-18T08:00:00Z',
      },
      supportingObservationIds: [
        ...soilMoistureObservations
          .filter(({ observedAt }) => observedAt >= '2026-07-14T08:00:00Z')
          .map(({ id }) => id),
        ...weatherObservations
          .filter(({ observedAt }) => observedAt >= '2026-07-14T08:00:00Z')
          .map(({ id }) => id),
      ],
      confidence: 0.92,
      recommendedVerification:
        'Inspect the irrigation line and verify vine condition in Sector B.',
    },
  ],
};

const canonicalState: DemoState = {
  schemaVersion: 2,
  selectedParcelId: INITIAL_PARCEL_ID,
  activeFindingId: ACTIVE_FINDING_ID,
  activeInspection: {
    id: 'inspection-01',
    findingId: ACTIVE_FINDING_ID,
    parcelId: AFFECTED_PARCEL_ID,
    sectorId: AFFECTED_SECTOR_ID,
    status: 'not-started',
    conversation: [],
    notes: [],
    photos: [],
    actions: [],
    nextStep: 'Verify irrigation delivery and capture field evidence.',
  },
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function getCanonicalDemoScenario(): DemoScenario {
  return clone(canonicalScenario);
}

export function getCanonicalDemoState(): DemoState {
  return clone(canonicalState);
}
