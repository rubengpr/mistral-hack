import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  FeatureCollection,
  MultiPolygon,
  Polygon,
  Position,
} from 'geojson';
import { describe, expect, it } from 'vitest';

type VineyardCluster = 'herault' | 'aude' | 'gard' | 'pyrenees-orientales';

type VineyardParcelProperties = {
  id: string;
  sourceParcelId: string;
  sourceDataset: 'IGN RPG 2024';
  sourceCropCode: 'VRC';
  name: string;
  cluster: VineyardCluster;
  municipality: string;
  municipalityInseeCode: string;
  department: string;
  departmentCode: string;
  crop: 'Wine-grape vineyard';
  areaHectares: number;
  demoRole: 'affected-candidate' | 'portfolio';
};

type VineyardDataset = FeatureCollection<
  Polygon | MultiPolygon,
  VineyardParcelProperties
> & {
  metadata: {
    sourceDataset: 'IGN RPG 2024';
    sourceYear: 2024;
    sourceCropCode: 'VRC';
    coordinateReferenceSystem: 'EPSG:4326';
    featureCount: 24;
  };
};

const datasetPath = resolve(
  process.cwd(),
  'lib/fixtures/vineyard-parcels.json',
);
const dataset = JSON.parse(
  readFileSync(datasetPath, 'utf8'),
) as VineyardDataset;

function coordinatePairs(geometry: Polygon | MultiPolygon): Position[] {
  return geometry.type === 'Polygon'
    ? geometry.coordinates.flat(1)
    : geometry.coordinates.flat(2);
}

describe('canonical vineyard parcel dataset', () => {
  it('contains 24 unique VRC parcels across four equal clusters', () => {
    expect(dataset.type).toBe('FeatureCollection');
    expect(dataset.features).toHaveLength(24);
    expect(dataset.metadata).toMatchObject({
      sourceDataset: 'IGN RPG 2024',
      sourceYear: 2024,
      sourceCropCode: 'VRC',
      coordinateReferenceSystem: 'EPSG:4326',
      featureCount: 24,
    });

    const ids = dataset.features.map(({ properties }) => properties.id);
    const sourceIds = dataset.features.map(
      ({ properties }) => properties.sourceParcelId,
    );
    expect(new Set(ids).size).toBe(24);
    expect(new Set(sourceIds).size).toBe(24);

    for (const cluster of [
      'herault',
      'aude',
      'gard',
      'pyrenees-orientales',
    ] satisfies VineyardCluster[]) {
      expect(
        dataset.features.filter(
          ({ properties }) => properties.cluster === cluster,
        ),
      ).toHaveLength(6);
    }
  });

  it('preserves valid WGS84 vineyard geometry and source metadata', () => {
    for (const feature of dataset.features) {
      expect(['Polygon', 'MultiPolygon']).toContain(feature.geometry.type);
      expect(feature.properties.sourceDataset).toBe('IGN RPG 2024');
      expect(feature.properties.sourceCropCode).toBe('VRC');
      expect(feature.properties.crop).toBe('Wine-grape vineyard');
      expect(feature.properties.areaHectares).toBeGreaterThanOrEqual(2);
      expect(feature.properties.areaHectares).toBeLessThanOrEqual(15);
      expect(feature.properties.municipality).not.toHaveLength(0);
      expect(feature.properties.municipalityInseeCode).not.toHaveLength(0);
      expect(feature.properties.department).not.toHaveLength(0);
      expect(feature.properties.departmentCode).toMatch(/^\d{2}$/);

      for (const [longitude, latitude] of coordinatePairs(feature.geometry)) {
        expect(longitude).toBeGreaterThanOrEqual(-180);
        expect(longitude).toBeLessThanOrEqual(180);
        expect(latitude).toBeGreaterThanOrEqual(-90);
        expect(latitude).toBeLessThanOrEqual(90);
      }
    }
  });

  it('marks exactly one Hérault parcel as the future affected candidate', () => {
    const affectedCandidates = dataset.features.filter(
      ({ properties }) => properties.demoRole === 'affected-candidate',
    );

    expect(affectedCandidates).toHaveLength(1);
    expect(affectedCandidates[0]?.properties.cluster).toBe('herault');
    expect(affectedCandidates[0]?.properties.departmentCode).toBe('34');
  });
});
