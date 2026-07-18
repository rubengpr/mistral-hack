import type { Position } from 'geojson';

import type { ParcelGeometry } from '@/types/agricultural-operations';

function getCoordinates(geometry: ParcelGeometry): Position[] {
  return geometry.type === 'Polygon'
    ? geometry.coordinates.flat(1)
    : geometry.coordinates.flat(2);
}

export function getParcelCenter(geometry: ParcelGeometry): [number, number] {
  const coordinates = getCoordinates(geometry);

  if (coordinates.length === 0) {
    throw new Error('The parcel geometry has no coordinates');
  }

  const bounds = coordinates.reduce(
    (current, [longitude, latitude]) => ({
      minimumLongitude: Math.min(current.minimumLongitude, longitude),
      maximumLongitude: Math.max(current.maximumLongitude, longitude),
      minimumLatitude: Math.min(current.minimumLatitude, latitude),
      maximumLatitude: Math.max(current.maximumLatitude, latitude),
    }),
    {
      minimumLongitude: Number.POSITIVE_INFINITY,
      maximumLongitude: Number.NEGATIVE_INFINITY,
      minimumLatitude: Number.POSITIVE_INFINITY,
      maximumLatitude: Number.NEGATIVE_INFINITY,
    },
  );

  return [
    (bounds.minimumLongitude + bounds.maximumLongitude) / 2,
    (bounds.minimumLatitude + bounds.maximumLatitude) / 2,
  ];
}
