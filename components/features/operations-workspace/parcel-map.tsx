'use client';

import { useEffect, useRef } from 'react';
import type { Feature, FeatureCollection, Point, Position } from 'geojson';
import maplibregl, {
  type ExpressionSpecification,
  type GeoJSONSource,
  type Map as MapLibreMap,
} from 'maplibre-gl';

import type {
  ParcelCluster,
  ParcelCollection,
  ParcelFeature,
  ParcelGeometry,
  ParcelMoistureStatus,
  SectorFeature,
} from '@/types/agricultural-operations';

const PARCEL_SOURCE_ID = 'parcels';
const PARCEL_FILL_LAYER_ID = 'parcel-fill';
const PARCEL_LINE_LAYER_ID = 'parcel-line';
const SECTOR_SOURCE_ID = 'affected-sector';
const SECTOR_FILL_LAYER_ID = 'affected-sector-fill';
const SECTOR_LINE_LAYER_ID = 'affected-sector-line';
const CLUSTER_SOURCE_ID = 'portfolio-clusters';
const CLUSTER_LAYER_ID = 'portfolio-cluster-circles';
const BASEMAP_SOURCE_ID = 'openstreetmap';
const BASEMAP_LAYER_ID = 'openstreetmap-basemap';
const OPENSTREETMAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const NEUTRAL_PARCEL_COLOR = '#2f3632';
const STABLE_PARCEL_COLOR = '#4f7f5e';
const REVIEW_PARCEL_COLOR = '#d39a3c';
const CRITICAL_PARCEL_COLOR = '#b55448';

type ClusterPointProperties = {
  cluster: ParcelCluster;
  label: string;
  totalCount: number;
  flaggedCount: number;
  moistureStatus: ParcelMoistureStatus;
};

type ClusterMarkerRecord = {
  marker: maplibregl.Marker;
  properties: ClusterPointProperties;
};

type ParcelMarkerRecord = {
  marker: maplibregl.Marker;
  moistureStatus: ParcelMoistureStatus;
};

const CLUSTER_LABELS: Record<ParcelCluster, string> = {
  herault: 'Hérault',
  aude: 'Aude',
  gard: 'Gard',
  'pyrenees-orientales': 'Pyrénées-Orientales',
};

function geometryPositions(geometry: ParcelGeometry): Position[] {
  return geometry.type === 'Polygon'
    ? geometry.coordinates.flat(1)
    : geometry.coordinates.flat(2);
}

function boundsFromPositions(positions: Position[]) {
  const firstPosition = positions[0] as [number, number];
  const bounds = new maplibregl.LngLatBounds(firstPosition, firstPosition);

  positions.forEach((position) => {
    bounds.extend(position as [number, number]);
  });

  return bounds;
}

function getFeatureBounds(feature: ParcelFeature) {
  return boundsFromPositions(geometryPositions(feature.geometry));
}

function getCollectionBounds(parcels: ParcelCollection) {
  return boundsFromPositions(
    parcels.features.flatMap(({ geometry }) => geometryPositions(geometry)),
  );
}

function getClusterBounds(parcels: ParcelCollection, cluster: ParcelCluster) {
  const positions = parcels.features
    .filter(({ properties }) => properties.cluster === cluster)
    .flatMap(({ geometry }) => geometryPositions(geometry));

  return positions.length > 0 ? boundsFromPositions(positions) : undefined;
}

function getHighestPriorityStatus(
  parcels: ParcelFeature[],
): ParcelMoistureStatus {
  if (
    parcels.some(({ properties }) => properties.moistureStatus === 'critical')
  ) {
    return 'critical';
  }

  if (parcels.some(({ properties }) => properties.moistureStatus === 'watch')) {
    return 'watch';
  }

  return 'stable';
}

export function createClusterPoints(
  parcels: ParcelCollection,
): FeatureCollection<Point, ClusterPointProperties> {
  const features = Object.entries(CLUSTER_LABELS).map(([cluster, label]) => {
    const parcelCluster = cluster as ParcelCluster;
    const clusterParcels = parcels.features.filter(
      ({ properties }) => properties.cluster === parcelCluster,
    );
    const clusterBounds = getClusterBounds(parcels, parcelCluster);
    const center = clusterBounds?.getCenter() ?? { lng: 0, lat: 0 };
    const flaggedCount = clusterParcels.filter(
      ({ properties }) => properties.moistureStatus !== 'stable',
    ).length;

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [center.lng, center.lat],
      },
      properties: {
        cluster: parcelCluster,
        label,
        totalCount: clusterParcels.length,
        flaggedCount,
        moistureStatus: getHighestPriorityStatus(clusterParcels),
      },
    } satisfies Feature<Point, ClusterPointProperties>;
  });

  return { type: 'FeatureCollection', features };
}

function createMapLabelElement(label: string, showGrape = false) {
  const element = document.createElement('div');
  element.className =
    'pointer-events-none max-w-56 truncate rounded-full border border-white/80 bg-foreground/90 px-2.5 py-1 text-[11px] font-semibold text-background shadow-sm transition-colors';
  element.textContent = showGrape ? `🍇 ${label}` : label;
  element.title = label;

  return element;
}

function getStatusColor(status: ParcelMoistureStatus) {
  if (status === 'critical') {
    return CRITICAL_PARCEL_COLOR;
  }

  if (status === 'watch') {
    return REVIEW_PARCEL_COLOR;
  }

  return STABLE_PARCEL_COLOR;
}

export function getMapLabelColor(
  moistureStatus: ParcelMoistureStatus,
  showParcelStatus: boolean,
) {
  return showParcelStatus
    ? getStatusColor(moistureStatus)
    : NEUTRAL_PARCEL_COLOR;
}

function updateClusterMarker(
  markerRecord: ClusterMarkerRecord,
  showParcelStatus: boolean,
) {
  const element = markerRecord.marker.getElement();
  const { label, moistureStatus, totalCount } = markerRecord.properties;
  const markerLabel = `${label} · ${totalCount}`;

  element.textContent = markerLabel;
  element.title = markerLabel;
  element.style.backgroundColor = getMapLabelColor(
    moistureStatus,
    showParcelStatus,
  );
}

function updateParcelMarker(
  markerRecord: ParcelMarkerRecord,
  showParcelStatus: boolean,
) {
  markerRecord.marker.getElement().style.backgroundColor = getMapLabelColor(
    markerRecord.moistureStatus,
    showParcelStatus,
  );
}

function getClusterCircleColor(
  showParcelStatus: boolean,
): string | ExpressionSpecification {
  if (!showParcelStatus) {
    return NEUTRAL_PARCEL_COLOR;
  }

  return [
    'match',
    ['get', 'moistureStatus'],
    'critical',
    CRITICAL_PARCEL_COLOR,
    'watch',
    REVIEW_PARCEL_COLOR,
    STABLE_PARCEL_COLOR,
  ];
}

export function getParcelFillColor(
  showParcelStatus: boolean,
): string | ExpressionSpecification {
  if (!showParcelStatus) {
    return NEUTRAL_PARCEL_COLOR;
  }

  return [
    'match',
    ['get', 'moistureStatus'],
    'critical',
    CRITICAL_PARCEL_COLOR,
    'watch',
    REVIEW_PARCEL_COLOR,
    STABLE_PARCEL_COLOR,
  ];
}

type ParcelMapProps = {
  parcels: ParcelCollection;
  affectedSector: SectorFeature;
  selectedParcelId?: string;
  showParcelStatus: boolean;
  onSelectParcel: (parcelId: string) => void;
};

export function ParcelMap({
  parcels,
  affectedSector,
  selectedParcelId,
  showParcelStatus,
  onSelectParcel,
}: ParcelMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const clusterMarkersRef = useRef<ClusterMarkerRecord[]>([]);
  const parcelMarkersRef = useRef<ParcelMarkerRecord[]>([]);
  const onSelectParcelRef = useRef(onSelectParcel);
  const selectedParcelIdRef = useRef(selectedParcelId);
  const showParcelStatusRef = useRef(showParcelStatus);
  const previousSelectedParcelIdRef = useRef(selectedParcelId);

  useEffect(() => {
    onSelectParcelRef.current = onSelectParcel;
  }, [onSelectParcel]);

  useEffect(() => {
    selectedParcelIdRef.current = selectedParcelId;
  }, [selectedParcelId]);

  useEffect(() => {
    showParcelStatusRef.current = showParcelStatus;
  }, [showParcelStatus]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const container = containerRef.current;
    const clusterMarkers: ClusterMarkerRecord[] = [];
    const parcelMarkers: ParcelMarkerRecord[] = [];
    const map = new maplibregl.Map({
      container,
      style: {
        version: 8,
        sources: {
          [BASEMAP_SOURCE_ID]: {
            type: 'raster',
            tiles: [OPENSTREETMAP_TILE_URL],
            tileSize: 256,
            maxzoom: 19,
            attribution:
              '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>',
          },
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#edf1ea' },
          },
          {
            id: BASEMAP_LAYER_ID,
            type: 'raster',
            source: BASEMAP_SOURCE_ID,
            paint: {
              'raster-opacity': 0.82,
              'raster-saturation': -0.32,
              'raster-contrast': -0.08,
            },
          },
        ],
      },
      center: [3.35, 43.3],
      zoom: 7,
      attributionControl: false,
    });
    const resizeObserver = new ResizeObserver(() => map.resize());

    resizeObserver.observe(container);

    map.addControl(
      new maplibregl.AttributionControl({ compact: false }),
      'bottom-right',
    );
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      'top-left',
    );

    map.on('load', () => {
      map.addSource(PARCEL_SOURCE_ID, {
        type: 'geojson',
        data: parcels,
        promoteId: 'id',
      });
      map.addLayer({
        id: PARCEL_FILL_LAYER_ID,
        type: 'fill',
        source: PARCEL_SOURCE_ID,
        paint: {
          'fill-color': getParcelFillColor(showParcelStatusRef.current),
          'fill-opacity': showParcelStatusRef.current ? 0.7 : 0.6,
        },
      });

      createClusterPoints(parcels).features.forEach((feature) => {
        const markerElement = createMapLabelElement(feature.properties.label);
        const marker = new maplibregl.Marker({ element: markerElement })
          .setLngLat(feature.geometry.coordinates as [number, number])
          .addTo(map);
        const markerRecord = { marker, properties: feature.properties };

        updateClusterMarker(markerRecord, showParcelStatusRef.current);
        clusterMarkers.push(markerRecord);
      });
      clusterMarkersRef.current = clusterMarkers;

      parcels.features.forEach((parcel) => {
        const markerElement = createMapLabelElement(
          parcel.properties.name,
          true,
        );
        const center = getFeatureBounds(parcel).getCenter();
        const marker = new maplibregl.Marker({
          element: markerElement,
          anchor: 'bottom',
          offset: [0, -8],
        })
          .setLngLat(center)
          .addTo(map);
        const markerRecord = {
          marker,
          moistureStatus: parcel.properties.moistureStatus,
        };

        updateParcelMarker(markerRecord, showParcelStatusRef.current);
        parcelMarkers.push(markerRecord);
      });
      parcelMarkersRef.current = parcelMarkers;

      const updateMarkerVisibility = () => {
        const showParcelLabels = map.getZoom() >= 10;
        clusterMarkers.forEach(({ marker }) => {
          marker.getElement().style.display = showParcelLabels ? 'none' : '';
        });
        parcelMarkers.forEach(({ marker }) => {
          marker.getElement().style.display = showParcelLabels ? '' : 'none';
        });
      };
      map.on('zoom', updateMarkerVisibility);
      updateMarkerVisibility();
      map.addLayer({
        id: PARCEL_LINE_LAYER_ID,
        type: 'line',
        source: PARCEL_SOURCE_ID,
        paint: {
          'line-color': '#ffffff',
          'line-width': [
            'case',
            ['==', ['get', 'id'], selectedParcelIdRef.current ?? ''],
            4,
            1.5,
          ],
        },
      });
      map.addSource(CLUSTER_SOURCE_ID, {
        type: 'geojson',
        data: createClusterPoints(parcels),
      });
      map.addLayer({
        id: CLUSTER_LAYER_ID,
        type: 'circle',
        source: CLUSTER_SOURCE_ID,
        maxzoom: 10,
        paint: {
          'circle-color': getClusterCircleColor(showParcelStatusRef.current),
          'circle-opacity': 0.86,
          'circle-radius': 11,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });
      map.addSource(SECTOR_SOURCE_ID, {
        type: 'geojson',
        data: affectedSector,
      });
      map.addLayer({
        id: SECTOR_FILL_LAYER_ID,
        type: 'fill',
        source: SECTOR_SOURCE_ID,
        layout: {
          visibility:
            selectedParcelIdRef.current === affectedSector.properties.parcelId
              ? 'visible'
              : 'none',
        },
        paint: {
          'fill-color': '#f0b35d',
          'fill-opacity': 0.55,
        },
      });
      map.addLayer({
        id: SECTOR_LINE_LAYER_ID,
        type: 'line',
        source: SECTOR_SOURCE_ID,
        layout: {
          visibility:
            selectedParcelIdRef.current === affectedSector.properties.parcelId
              ? 'visible'
              : 'none',
        },
        paint: {
          'line-color': '#7b3f22',
          'line-width': 2.5,
          'line-dasharray': [2, 1],
        },
      });

      map.on('click', PARCEL_FILL_LAYER_ID, (event) => {
        const parcelId = event.features?.[0]?.properties?.id;
        if (typeof parcelId === 'string') {
          onSelectParcelRef.current(parcelId);
        }
      });
      map.on('click', CLUSTER_LAYER_ID, (event) => {
        const cluster = event.features?.[0]?.properties?.cluster as
          ParcelCluster | undefined;
        const clusterBounds = cluster
          ? getClusterBounds(parcels, cluster)
          : undefined;

        if (clusterBounds) {
          map.fitBounds(clusterBounds, {
            padding: 72,
            duration: 650,
            maxZoom: 12,
          });
        }
      });
      map.on('mouseenter', PARCEL_FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', PARCEL_FILL_LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });
      map.on('mouseenter', CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', CLUSTER_LAYER_ID, () => {
        map.getCanvas().style.cursor = '';
      });

      map.fitBounds(getCollectionBounds(parcels), {
        padding: 64,
        duration: 0,
        maxZoom: 9,
      });
    });

    mapRef.current = map;

    return () => {
      resizeObserver.disconnect();
      clusterMarkers.forEach(({ marker }) => marker.remove());
      clusterMarkersRef.current = [];
      parcelMarkers.forEach(({ marker }) => marker.remove());
      parcelMarkersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [affectedSector, parcels]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) {
      return;
    }

    const source = map.getSource(PARCEL_SOURCE_ID) as GeoJSONSource | undefined;
    source?.setData(parcels);
    map.setPaintProperty(
      PARCEL_FILL_LAYER_ID,
      'fill-color',
      getParcelFillColor(showParcelStatus),
    );
    map.setPaintProperty(
      PARCEL_FILL_LAYER_ID,
      'fill-opacity',
      showParcelStatus ? 0.7 : 0.6,
    );
    map.setPaintProperty(
      CLUSTER_LAYER_ID,
      'circle-color',
      getClusterCircleColor(showParcelStatus),
    );
    clusterMarkersRef.current.forEach((markerRecord) => {
      updateClusterMarker(markerRecord, showParcelStatus);
    });
    parcelMarkersRef.current.forEach((markerRecord) => {
      updateParcelMarker(markerRecord, showParcelStatus);
    });
    map.setPaintProperty(PARCEL_LINE_LAYER_ID, 'line-width', [
      'case',
      ['==', ['get', 'id'], selectedParcelId ?? ''],
      4,
      1.5,
    ]);
    const sectorVisibility =
      selectedParcelId === affectedSector.properties.parcelId
        ? 'visible'
        : 'none';
    map.setLayoutProperty(SECTOR_FILL_LAYER_ID, 'visibility', sectorVisibility);
    map.setLayoutProperty(SECTOR_LINE_LAYER_ID, 'visibility', sectorVisibility);

    if (previousSelectedParcelIdRef.current === selectedParcelId) {
      return;
    }
    previousSelectedParcelIdRef.current = selectedParcelId;

    const selectedParcel = parcels.features.find(
      (feature) => feature.properties.id === selectedParcelId,
    );
    if (selectedParcel) {
      map.fitBounds(getFeatureBounds(selectedParcel), {
        padding: 90,
        duration: 650,
        maxZoom: 16,
      });
    }
  }, [
    affectedSector.properties.parcelId,
    parcels,
    selectedParcelId,
    showParcelStatus,
  ]);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-72 w-full"
      role="application"
      aria-label="Interactive vineyard portfolio map. Select a region or parcel to review its data."
    />
  );
}
