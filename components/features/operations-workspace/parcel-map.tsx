'use client';

import { useEffect, useRef } from 'react';
import type { Feature, FeatureCollection, Point, Position } from 'geojson';
import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
} from 'maplibre-gl';

import type {
  ParcelCluster,
  ParcelCollection,
  ParcelFeature,
  ParcelGeometry,
  SectorFeature,
} from '@/types/agricultural-operations';

const PARCEL_SOURCE_ID = 'parcels';
const PARCEL_FILL_LAYER_ID = 'parcel-fill';
const PARCEL_LINE_LAYER_ID = 'parcel-line';
const SECTOR_SOURCE_ID = 'affected-sector';
const CLUSTER_SOURCE_ID = 'portfolio-clusters';
const CLUSTER_LAYER_ID = 'portfolio-cluster-circles';
const BASEMAP_SOURCE_ID = 'openstreetmap';
const BASEMAP_LAYER_ID = 'openstreetmap-basemap';
const OPENSTREETMAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

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

function createClusterPoints(
  parcels: ParcelCollection,
): FeatureCollection<Point, { cluster: ParcelCluster; label: string }> {
  const features = Object.entries(CLUSTER_LABELS).map(([cluster, label]) => {
    const clusterBounds = getClusterBounds(parcels, cluster as ParcelCluster);
    const center = clusterBounds?.getCenter() ?? { lng: 0, lat: 0 };

    return {
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [center.lng, center.lat],
      },
      properties: { cluster: cluster as ParcelCluster, label },
    } satisfies Feature<Point, { cluster: ParcelCluster; label: string }>;
  });

  return { type: 'FeatureCollection', features };
}

function createMapLabelElement(label: string, showGrape = false) {
  const element = document.createElement('div');
  element.className =
    'pointer-events-none max-w-44 truncate rounded-full border border-white/80 bg-foreground/90 px-2.5 py-1 text-[11px] font-semibold text-background shadow-sm';
  element.textContent = showGrape ? `🍇 ${label}` : label;
  element.title = label;

  return element;
}

type ParcelMapProps = {
  parcels: ParcelCollection;
  affectedSector: SectorFeature;
  selectedParcelId: string;
  onSelectParcel: (parcelId: string) => void;
};

export function ParcelMap({
  parcels,
  affectedSector,
  selectedParcelId,
  onSelectParcel,
}: ParcelMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onSelectParcelRef = useRef(onSelectParcel);
  const selectedParcelIdRef = useRef(selectedParcelId);
  const previousSelectedParcelIdRef = useRef(selectedParcelId);

  useEffect(() => {
    onSelectParcelRef.current = onSelectParcel;
  }, [onSelectParcel]);

  useEffect(() => {
    selectedParcelIdRef.current = selectedParcelId;
  }, [selectedParcelId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const container = containerRef.current;
    const clusterMarkers: maplibregl.Marker[] = [];
    const parcelMarkers: maplibregl.Marker[] = [];
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
      'top-right',
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
          'fill-color': [
            'case',
            ['==', ['get', 'id'], selectedParcelIdRef.current],
            '#315c4a',
            ['==', ['get', 'moistureStatus'], 'critical'],
            '#b86b4b',
            ['==', ['get', 'moistureStatus'], 'watch'],
            '#c99850',
            '#7d9b83',
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'id'], selectedParcelIdRef.current],
            0.78,
            0.58,
          ],
        },
      });

      createClusterPoints(parcels).features.forEach((feature) => {
        const markerElement = createMapLabelElement(
          `${feature.properties.label} · 6`,
        );
        clusterMarkers.push(
          new maplibregl.Marker({ element: markerElement })
            .setLngLat(feature.geometry.coordinates as [number, number])
            .addTo(map),
        );
      });

      parcels.features.forEach((parcel) => {
        const markerElement = createMapLabelElement(
          parcel.properties.name,
          true,
        );
        const center = getFeatureBounds(parcel).getCenter();
        parcelMarkers.push(
          new maplibregl.Marker({
            element: markerElement,
            anchor: 'bottom',
            offset: [0, -8],
          })
            .setLngLat(center)
            .addTo(map),
        );
      });

      const updateMarkerVisibility = () => {
        const showParcelLabels = map.getZoom() >= 10;
        clusterMarkers.forEach((marker) => {
          marker.getElement().style.display = showParcelLabels ? 'none' : '';
        });
        parcelMarkers.forEach((marker) => {
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
            ['==', ['get', 'id'], selectedParcelIdRef.current],
            3,
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
          'circle-color': '#315c4a',
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
        id: 'affected-sector-fill',
        type: 'fill',
        source: SECTOR_SOURCE_ID,
        paint: {
          'fill-color': '#f0b35d',
          'fill-opacity': 0.55,
        },
      });
      map.addLayer({
        id: 'affected-sector-line',
        type: 'line',
        source: SECTOR_SOURCE_ID,
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
      clusterMarkers.forEach((marker) => marker.remove());
      parcelMarkers.forEach((marker) => marker.remove());
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
    map.setPaintProperty(PARCEL_FILL_LAYER_ID, 'fill-color', [
      'case',
      ['==', ['get', 'id'], selectedParcelId],
      '#315c4a',
      ['==', ['get', 'moistureStatus'], 'critical'],
      '#b86b4b',
      ['==', ['get', 'moistureStatus'], 'watch'],
      '#c99850',
      '#7d9b83',
    ]);
    map.setPaintProperty(PARCEL_LINE_LAYER_ID, 'line-width', [
      'case',
      ['==', ['get', 'id'], selectedParcelId],
      3,
      1.5,
    ]);

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
  }, [parcels, selectedParcelId]);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-72 w-full"
      role="application"
      aria-label="Interactive vineyard portfolio map. Select a region or parcel to review its data."
    />
  );
}
