import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format as formatWithPrettier } from 'prettier';

const RPG_ENDPOINT = 'https://apicarto.ign.fr/api/rpg/v2';
const COMMUNE_ENDPOINT = 'https://apicarto.ign.fr/api/cadastre/commune';
const SOURCE_DATASET = 'IGN RPG 2024';
const SOURCE_YEAR = 2024;
const SOURCE_CROP_CODE = 'VRC';
const MIN_AREA_HECTARES = 2;
const MAX_AREA_HECTARES = 15;
const PAGE_SIZE = 1000;
const MAX_ATTEMPTS = 3;
const GRID_COLUMNS = 3;
const GRID_ROWS = 2;
const FEATURES_PER_CLUSTER = GRID_COLUMNS * GRID_ROWS;
const TOTAL_FEATURES = 24;
const PEZENAS_CENTER = [3.4233, 43.459];

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(SCRIPT_DIRECTORY, '..');
const OUTPUT_PATH = resolve(PROJECT_ROOT, 'lib/fixtures/vineyard-parcels.json');

const CLUSTERS = [
  {
    id: 'herault',
    label: 'Hérault',
    department: 'Hérault',
    departmentCode: '34',
    bounds: [3.18, 43.3, 3.5, 43.53],
  },
  {
    id: 'aude',
    label: 'Aude',
    department: 'Aude',
    departmentCode: '11',
    bounds: [2.88, 43.08, 3.15, 43.28],
  },
  {
    id: 'gard',
    label: 'Gard',
    department: 'Gard',
    departmentCode: '30',
    bounds: [4.15, 43.7, 4.55, 44],
  },
  {
    id: 'pyrenees-orientales',
    label: 'Pyrénées-Orientales',
    department: 'Pyrénées-Orientales',
    departmentCode: '66',
    bounds: [2.7, 42.55, 3.05, 42.85],
  },
];

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function fetchJson(url, label) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });

      if (!response.ok) {
        throw new Error(`${label} returned HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await delay(500 * 2 ** (attempt - 1));
      }
    }
  }

  throw new Error(
    `${label} failed after ${MAX_ATTEMPTS} attempts: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function createGridCells(bounds) {
  const [west, south, east, north] = bounds;
  const cellWidth = (east - west) / GRID_COLUMNS;
  const cellHeight = (north - south) / GRID_ROWS;
  const cells = [];

  for (let row = 0; row < GRID_ROWS; row += 1) {
    for (let column = 0; column < GRID_COLUMNS; column += 1) {
      const cellWest = west + column * cellWidth;
      const cellSouth = south + row * cellHeight;
      cells.push({
        index: row * GRID_COLUMNS + column,
        bounds: [
          cellWest,
          cellSouth,
          cellWest + cellWidth,
          cellSouth + cellHeight,
        ],
      });
    }
  }

  return cells;
}

function boundsToPolygon([west, south, east, north]) {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  };
}

function rpgUrl(cellBounds, start) {
  const url = new URL(RPG_ENDPOINT);
  url.searchParams.set('annee', String(SOURCE_YEAR));
  url.searchParams.set('code_cultu', SOURCE_CROP_CODE);
  url.searchParams.set('_limit', String(PAGE_SIZE));
  url.searchParams.set('_start', String(start));
  url.searchParams.set('geom', JSON.stringify(boundsToPolygon(cellBounds)));
  return url;
}

async function fetchCellCandidates(cluster, cell) {
  const candidates = [];
  let start = 0;

  while (true) {
    const page = await fetchJson(
      rpgUrl(cell.bounds, start),
      `${cluster.label} grid cell ${cell.index + 1}`,
    );
    const features = Array.isArray(page.features) ? page.features : [];
    candidates.push(...features);

    const numberReturned = Number(page.numberReturned ?? features.length);
    const numberMatched = Number(page.numberMatched ?? candidates.length);
    start += numberReturned;

    if (
      numberReturned === 0 ||
      numberReturned < PAGE_SIZE ||
      start >= numberMatched
    ) {
      break;
    }
  }

  return candidates;
}

function polygonCentroid(ring) {
  let signedArea = 0;
  let longitudeTotal = 0;
  let latitudeTotal = 0;

  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    const crossProduct = x1 * y2 - x2 * y1;
    signedArea += crossProduct;
    longitudeTotal += (x1 + x2) * crossProduct;
    latitudeTotal += (y1 + y2) * crossProduct;
  }

  signedArea /= 2;
  if (Math.abs(signedArea) < Number.EPSILON) {
    return ring[0];
  }

  return [longitudeTotal / (6 * signedArea), latitudeTotal / (6 * signedArea)];
}

function outerRings(geometry) {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates[0]];
  }

  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.map((polygon) => polygon[0]);
  }

  return [];
}

function ringArea(ring) {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    area +=
      ring[index][0] * ring[index + 1][1] - ring[index + 1][0] * ring[index][1];
  }
  return Math.abs(area / 2);
}

function featureCentroid(feature) {
  const rings = outerRings(feature.geometry);
  if (rings.length === 0) {
    throw new Error(`Unsupported geometry for RPG parcel ${feature.id}`);
  }

  const largestRing = rings.toSorted((left, right) => {
    return ringArea(right) - ringArea(left);
  })[0];

  return polygonCentroid(largestRing);
}

function isPointInBounds([longitude, latitude], [west, south, east, north]) {
  return (
    longitude >= west &&
    longitude <= east &&
    latitude >= south &&
    latitude <= north
  );
}

function isSupportedGeometry(geometry) {
  return geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon';
}

function selectCellParcel(features, cell, usedSourceIds) {
  const candidates = features
    .filter((feature) => {
      const properties = feature?.properties;
      const sourceId = String(properties?.id_parcel ?? '');
      const areaHectares = Number(properties?.surf_parc);

      if (
        !sourceId ||
        usedSourceIds.has(sourceId) ||
        properties?.code_cultu !== SOURCE_CROP_CODE ||
        !isSupportedGeometry(feature?.geometry) ||
        !Number.isFinite(areaHectares) ||
        areaHectares < MIN_AREA_HECTARES ||
        areaHectares > MAX_AREA_HECTARES
      ) {
        return false;
      }

      return isPointInBounds(featureCentroid(feature), cell.bounds);
    })
    .toSorted((left, right) => {
      const areaDifference =
        Number(right.properties.surf_parc) - Number(left.properties.surf_parc);
      if (areaDifference !== 0) {
        return areaDifference;
      }

      return String(left.properties.id_parcel).localeCompare(
        String(right.properties.id_parcel),
      );
    });

  return candidates[0];
}

function communeUrl(point) {
  const url = new URL(COMMUNE_ENDPOINT);
  url.searchParams.set(
    'geom',
    JSON.stringify({ type: 'Point', coordinates: point }),
  );
  url.searchParams.set('_limit', '5');
  return url;
}

async function resolveMunicipality(feature, cluster) {
  const response = await fetchJson(
    communeUrl(featureCentroid(feature)),
    `municipality for RPG parcel ${feature.properties.id_parcel}`,
  );
  const communes = Array.isArray(response.features) ? response.features : [];
  const commune = communes
    .filter(
      (candidate) => candidate?.properties?.code_dep === cluster.departmentCode,
    )
    .toSorted((left, right) =>
      String(left.properties.code_insee).localeCompare(
        String(right.properties.code_insee),
      ),
    )[0];

  if (!commune?.properties?.nom_com || !commune.properties.code_insee) {
    throw new Error(
      `Could not resolve a ${cluster.label} municipality for RPG parcel ${feature.properties.id_parcel}`,
    );
  }

  return {
    name: commune.properties.nom_com,
    inseeCode: commune.properties.code_insee,
  };
}

function distanceSquared(
  [longitude, latitude],
  [targetLongitude, targetLatitude],
) {
  return (longitude - targetLongitude) ** 2 + (latitude - targetLatitude) ** 2;
}

async function buildClusterFeatures(cluster) {
  const usedSourceIds = new Set();
  const selected = [];

  for (const cell of createGridCells(cluster.bounds)) {
    const candidates = await fetchCellCandidates(cluster, cell);
    const parcel = selectCellParcel(candidates, cell, usedSourceIds);

    if (!parcel) {
      throw new Error(
        `${cluster.label} grid cell ${cell.index + 1} has no eligible ${SOURCE_CROP_CODE} parcel between ${MIN_AREA_HECTARES} and ${MAX_AREA_HECTARES} hectares`,
      );
    }

    const sourceParcelId = String(parcel.properties.id_parcel);
    usedSourceIds.add(sourceParcelId);
    selected.push({ cell, parcel, sourceParcelId });
  }

  if (selected.length !== FEATURES_PER_CLUSTER) {
    throw new Error(
      `${cluster.label} produced ${selected.length} parcels instead of ${FEATURES_PER_CLUSTER}`,
    );
  }

  const municipalities = await Promise.all(
    selected.map(({ parcel }) => resolveMunicipality(parcel, cluster)),
  );

  return selected.map(({ parcel, sourceParcelId }, index) => ({
    type: 'Feature',
    id: `parcel-${cluster.id}-${String(index + 1).padStart(2, '0')}`,
    geometry: parcel.geometry,
    properties: {
      id: `parcel-${cluster.id}-${String(index + 1).padStart(2, '0')}`,
      sourceParcelId,
      sourceDataset: SOURCE_DATASET,
      sourceCropCode: SOURCE_CROP_CODE,
      name: `${municipalities[index].name} Vineyard ${String(index + 1).padStart(2, '0')}`,
      cluster: cluster.id,
      municipality: municipalities[index].name,
      municipalityInseeCode: municipalities[index].inseeCode,
      department: cluster.department,
      departmentCode: cluster.departmentCode,
      crop: 'Wine-grape vineyard',
      areaHectares: Number(parcel.properties.surf_parc),
      demoRole: 'portfolio',
    },
  }));
}

function coordinatePairs(geometry) {
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.flat(1);
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.flat(2);
  }
  return [];
}

function validateDataset(dataset) {
  const errors = [];
  const features = Array.isArray(dataset?.features) ? dataset.features : [];

  if (dataset?.type !== 'FeatureCollection') {
    errors.push('Dataset must be a GeoJSON FeatureCollection');
  }
  if (features.length !== TOTAL_FEATURES) {
    errors.push(
      `Expected ${TOTAL_FEATURES} features, received ${features.length}`,
    );
  }

  const ids = new Set();
  const sourceIds = new Set();
  const clusterCounts = new Map();
  let affectedCandidates = 0;

  for (const feature of features) {
    const properties = feature?.properties ?? {};
    const cluster = CLUSTERS.find(({ id }) => id === properties.cluster);

    if (!isSupportedGeometry(feature?.geometry)) {
      errors.push(
        `${properties.id ?? 'Unknown feature'} has unsupported geometry`,
      );
      continue;
    }
    if (!cluster) {
      errors.push(
        `${properties.id ?? 'Unknown feature'} has an unknown cluster`,
      );
      continue;
    }

    if (ids.has(properties.id)) {
      errors.push(`Duplicate feature id ${properties.id}`);
    }
    ids.add(properties.id);

    if (sourceIds.has(properties.sourceParcelId)) {
      errors.push(`Duplicate RPG parcel id ${properties.sourceParcelId}`);
    }
    sourceIds.add(properties.sourceParcelId);

    clusterCounts.set(
      properties.cluster,
      (clusterCounts.get(properties.cluster) ?? 0) + 1,
    );

    if (properties.sourceDataset !== SOURCE_DATASET) {
      errors.push(`${properties.id} has the wrong source dataset`);
    }
    if (properties.sourceCropCode !== SOURCE_CROP_CODE) {
      errors.push(`${properties.id} is not a ${SOURCE_CROP_CODE} parcel`);
    }
    if (
      !Number.isFinite(properties.areaHectares) ||
      properties.areaHectares < MIN_AREA_HECTARES ||
      properties.areaHectares > MAX_AREA_HECTARES
    ) {
      errors.push(`${properties.id} has an out-of-range area`);
    }
    if (
      !properties.municipality ||
      !properties.municipalityInseeCode ||
      properties.department !== cluster.department ||
      properties.departmentCode !== cluster.departmentCode
    ) {
      errors.push(`${properties.id} has incomplete location metadata`);
    }
    if (properties.demoRole === 'affected-candidate') {
      affectedCandidates += 1;
      if (properties.cluster !== 'herault') {
        errors.push('The affected candidate must be in Hérault');
      }
    } else if (properties.demoRole !== 'portfolio') {
      errors.push(`${properties.id} has an invalid demo role`);
    }

    for (const coordinate of coordinatePairs(feature.geometry)) {
      const [longitude, latitude] = coordinate;
      if (
        !Number.isFinite(longitude) ||
        !Number.isFinite(latitude) ||
        longitude < -180 ||
        longitude > 180 ||
        latitude < -90 ||
        latitude > 90
      ) {
        errors.push(`${properties.id} has an invalid WGS84 coordinate`);
        break;
      }
    }
  }

  for (const cluster of CLUSTERS) {
    if (clusterCounts.get(cluster.id) !== FEATURES_PER_CLUSTER) {
      errors.push(
        `${cluster.label} must contain ${FEATURES_PER_CLUSTER} parcels`,
      );
    }
  }
  if (affectedCandidates !== 1) {
    errors.push(
      `Expected one affected candidate, received ${affectedCandidates}`,
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Vineyard dataset validation failed:\n- ${errors.join('\n- ')}`,
    );
  }

  return dataset;
}

function markAffectedCandidate(features) {
  const heraultFeatures = features.filter(
    ({ properties }) => properties.cluster === 'herault',
  );
  const closest = heraultFeatures.toSorted((left, right) => {
    return (
      distanceSquared(featureCentroid(left), PEZENAS_CENTER) -
      distanceSquared(featureCentroid(right), PEZENAS_CENTER)
    );
  })[0];

  if (!closest) {
    throw new Error('No Hérault parcel is available as the affected candidate');
  }

  return features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      demoRole:
        feature.properties.id === closest.properties.id
          ? 'affected-candidate'
          : 'portfolio',
    },
  }));
}

async function generateDataset() {
  const clusterFeatures = [];

  for (const cluster of CLUSTERS) {
    process.stdout.write(`Selecting ${cluster.label} vineyards...\n`);
    clusterFeatures.push(...(await buildClusterFeatures(cluster)));
  }

  const features = markAffectedCandidate(clusterFeatures);
  const dataset = validateDataset({
    type: 'FeatureCollection',
    name: 'Canonical Occitanie vineyard portfolio',
    metadata: {
      sourceDataset: SOURCE_DATASET,
      sourceUrl: RPG_ENDPOINT,
      sourceYear: SOURCE_YEAR,
      sourceCropCode: SOURCE_CROP_CODE,
      license: 'Licence Ouverte 2.0',
      licenseUrl: 'https://www.etalab.gouv.fr/licence-ouverte-open-licence',
      coordinateReferenceSystem: 'EPSG:4326',
      selectionVersion: 1,
      featureCount: TOTAL_FEATURES,
    },
    features,
  });

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  const formattedDataset = await formatWithPrettier(JSON.stringify(dataset), {
    parser: 'json',
  });

  const temporaryPath = `${OUTPUT_PATH}.tmp`;
  await writeFile(temporaryPath, formattedDataset);
  await rename(temporaryPath, OUTPUT_PATH);

  process.stdout.write(`Wrote ${TOTAL_FEATURES} vineyards to ${OUTPUT_PATH}\n`);
}

async function checkDataset() {
  const contents = await readFile(OUTPUT_PATH, 'utf8');
  validateDataset(JSON.parse(contents));

  process.stdout.write(
    `Validated ${TOTAL_FEATURES} vineyards in ${OUTPUT_PATH}\n`,
  );
}

if (process.argv.includes('--check')) {
  await checkDataset();
} else {
  await generateDataset();
}
