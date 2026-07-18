import type {
  PortfolioWaterReview,
  WeatherForecast,
  WeatherForecastQuery,
  WeatherSeries,
  WeatherSeriesQuery,
} from '@/types/weather';

type WeatherApiSuccess = {
  success: true;
  data: WeatherSeries;
};

type WeatherApiError = {
  error: string;
};

export async function fetchWeatherSeries(
  query: WeatherSeriesQuery,
  signal?: AbortSignal,
): Promise<WeatherSeries> {
  const searchParams = new URLSearchParams({
    latitude: String(query.latitude),
    longitude: String(query.longitude),
    startDate: query.startDate,
    endDate: query.endDate,
  });
  const response = await fetch(`/api/weather?${searchParams}`, { signal });
  const body = (await response.json()) as WeatherApiSuccess | WeatherApiError;

  if (!response.ok || !('success' in body)) {
    throw new Error('error' in body ? body.error : 'Unable to load weather.');
  }

  return body.data;
}

export async function fetchWeatherForecast(
  query: WeatherForecastQuery,
  signal?: AbortSignal,
): Promise<WeatherForecast> {
  const searchParams = new URLSearchParams();

  if (query.scope === 'parcel') {
    searchParams.set('parcelId', query.parcelId);
  } else {
    searchParams.set('cluster', query.cluster);
  }
  if (query.referenceDate) {
    searchParams.set('referenceDate', query.referenceDate);
  }

  const response = await fetch(`/api/weather-forecast?${searchParams}`, {
    signal,
  });
  const body = (await response.json()) as
    { success: true; data: WeatherForecast } | WeatherApiError;

  if (!response.ok || !('success' in body)) {
    throw new Error('error' in body ? body.error : 'Unable to load forecast.');
  }

  return body.data;
}

export async function fetchPortfolioWaterReview(
  signal?: AbortSignal,
): Promise<PortfolioWaterReview> {
  const response = await fetch('/api/water-review', { signal });
  const body = (await response.json()) as
    { success: true; data: PortfolioWaterReview } | WeatherApiError;

  if (!response.ok || !('success' in body)) {
    throw new Error(
      'error' in body ? body.error : 'Unable to load regional review.',
    );
  }

  return body.data;
}
