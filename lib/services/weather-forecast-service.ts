import { createWeatherForecastFallback } from '@/lib/fixtures/weather-forecast-fallback';
import { getCanonicalDemoScenario } from '@/lib/fixtures/canonical-demo-scenario';
import { getParcelCenter } from '@/lib/geo/parcel-center';
import { getOpenMeteoForecast } from '@/lib/integrations/open-meteo/open-meteo-forecast-client';
import type { ParcelCluster } from '@/types/agricultural-operations';
import type {
  WeatherForecast,
  WeatherForecastQuery,
  WeatherForecastScope,
} from '@/types/weather';

export class WeatherForecastLocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeatherForecastLocationError';
  }
}

function resolveLocation(scope: WeatherForecastScope) {
  const parcels = getCanonicalDemoScenario().parcels.features;

  if (scope.scope === 'parcel') {
    const parcel = parcels.find(
      ({ properties }) => properties.id === scope.parcelId,
    );

    if (!parcel) {
      throw new WeatherForecastLocationError('The parcel was not found.');
    }

    const [longitude, latitude] = getParcelCenter(parcel.geometry);
    return {
      cluster: parcel.properties.cluster,
      location: { latitude, longitude, label: parcel.properties.name },
    };
  }

  const clusterParcels = parcels.filter(
    ({ properties }) => properties.cluster === scope.cluster,
  );

  if (clusterParcels.length === 0) {
    throw new WeatherForecastLocationError('The cluster was not found.');
  }

  const centers = clusterParcels.map(({ geometry }) =>
    getParcelCenter(geometry),
  );
  const longitude =
    centers.reduce((sum, center) => sum + center[0], 0) / centers.length;
  const latitude =
    centers.reduce((sum, center) => sum + center[1], 0) / centers.length;
  const clusterLabels: Record<ParcelCluster, string> = {
    herault: 'Hérault',
    aude: 'Aude',
    gard: 'Gard',
    'pyrenees-orientales': 'Pyrénées-Orientales',
  };

  return {
    cluster: scope.cluster,
    location: { latitude, longitude, label: clusterLabels[scope.cluster] },
  };
}

export async function getWeatherForecast(
  query: WeatherForecastQuery,
): Promise<WeatherForecast> {
  const { referenceDate = new Date().toISOString().slice(0, 10), ...scope } =
    query;
  const resolved = resolveLocation(scope);

  try {
    return await getOpenMeteoForecast(scope, resolved.location, referenceDate);
  } catch {
    return createWeatherForecastFallback(
      scope,
      resolved.cluster,
      resolved.location,
      referenceDate,
    );
  }
}
