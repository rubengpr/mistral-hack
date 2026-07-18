import { createWeatherSeriesFallback } from '@/lib/fixtures/weather-series-fallback';
import { getOpenMeteoWeatherSeries } from '@/lib/integrations/open-meteo/open-meteo-client';
import type { WeatherSeries, WeatherSeriesQuery } from '@/types/weather';

export async function getWeatherSeries(
  query: WeatherSeriesQuery,
): Promise<WeatherSeries> {
  try {
    return await getOpenMeteoWeatherSeries(query);
  } catch {
    return createWeatherSeriesFallback(query);
  }
}
