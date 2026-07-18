import type { WeatherSeries, WeatherSeriesQuery } from '@/types/weather';

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
