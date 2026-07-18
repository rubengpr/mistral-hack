import { z } from 'zod';

import type { WeatherSeries, WeatherSeriesQuery } from '@/types/weather';

const OPEN_METEO_URL =
  'https://historical-forecast-api.open-meteo.com/v1/forecast';

const openMeteoResponseSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  daily: z.object({
    time: z.array(z.string()),
    precipitation_sum: z.array(z.number().nullable()),
    temperature_2m_max: z.array(z.number().nullable()),
    et0_fao_evapotranspiration: z.array(z.number().nullable()),
  }),
});

function formatLabel(date: string): string {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export async function getOpenMeteoWeatherSeries(
  query: WeatherSeriesQuery,
): Promise<WeatherSeries> {
  const searchParams = new URLSearchParams({
    latitude: String(query.latitude),
    longitude: String(query.longitude),
    start_date: query.startDate,
    end_date: query.endDate,
    daily: 'precipitation_sum,temperature_2m_max,et0_fao_evapotranspiration',
    timezone: 'Europe/Paris',
  });
  const response = await fetch(`${OPEN_METEO_URL}?${searchParams}`, {
    next: { revalidate: 60 * 60 },
    signal: AbortSignal.timeout(2_000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo returned HTTP ${response.status}`);
  }

  const parsed = openMeteoResponseSchema.parse(await response.json());
  const { daily } = parsed;
  const points = daily.time.map((date, index) => {
    const precipitationMillimeters = daily.precipitation_sum[index];
    const maximumTemperatureCelsius = daily.temperature_2m_max[index];
    const evapotranspirationMillimeters =
      daily.et0_fao_evapotranspiration[index];

    if (
      precipitationMillimeters === null ||
      precipitationMillimeters === undefined ||
      maximumTemperatureCelsius === null ||
      maximumTemperatureCelsius === undefined ||
      evapotranspirationMillimeters === null ||
      evapotranspirationMillimeters === undefined
    ) {
      throw new Error('Open-Meteo returned an incomplete daily series');
    }

    return {
      date,
      label: formatLabel(date),
      precipitationMillimeters,
      maximumTemperatureCelsius,
      evapotranspirationMillimeters,
    };
  });

  if (points.length === 0) {
    throw new Error('Open-Meteo returned an empty daily series');
  }

  return {
    source: 'open-meteo',
    sourceLabel: 'Open-Meteo historical forecast',
    attributionUrl: 'https://open-meteo.com',
    latitude: parsed.latitude,
    longitude: parsed.longitude,
    timezone: parsed.timezone,
    startsOn: points[0].date,
    endsOn: points.at(-1)?.date ?? points[0].date,
    points,
  };
}
