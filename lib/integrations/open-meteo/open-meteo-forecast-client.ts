import { z } from 'zod';

import type {
  DailyWeatherPoint,
  WeatherForecast,
  WeatherForecastScope,
} from '@/types/weather';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const HISTORICAL_FORECAST_URL =
  'https://historical-forecast-api.open-meteo.com/v1/forecast';
const DAILY_VARIABLES =
  'precipitation_sum,temperature_2m_max,et0_fao_evapotranspiration';

const responseSchema = z.object({
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

type ForecastLocation = {
  latitude: number;
  longitude: number;
  label: string;
};

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatLabel(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function normalizeDaily(
  response: z.infer<typeof responseSchema>,
): DailyWeatherPoint[] {
  return response.daily.time.map((date, index) => {
    const precipitationMillimeters = response.daily.precipitation_sum[index];
    const maximumTemperatureCelsius = response.daily.temperature_2m_max[index];
    const evapotranspirationMillimeters =
      response.daily.et0_fao_evapotranspiration[index];

    if (
      precipitationMillimeters == null ||
      maximumTemperatureCelsius == null ||
      evapotranspirationMillimeters == null
    ) {
      throw new Error('Open-Meteo returned an incomplete daily forecast');
    }

    return {
      date,
      label: formatLabel(date),
      precipitationMillimeters,
      maximumTemperatureCelsius,
      evapotranspirationMillimeters,
    };
  });
}

async function fetchDaily(
  url: string,
  location: ForecastLocation,
  startDate: string,
  endDate: string,
) {
  const searchParams = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    start_date: startDate,
    end_date: endDate,
    daily: DAILY_VARIABLES,
    timezone: 'Europe/Paris',
  });
  const response = await fetch(`${url}?${searchParams}`, {
    next: { revalidate: 60 * 60 },
    signal: AbortSignal.timeout(3_000),
  });

  if (!response.ok) {
    throw new Error(`Open-Meteo returned HTTP ${response.status}`);
  }

  return responseSchema.parse(await response.json());
}

function total(
  points: DailyWeatherPoint[],
  key: 'precipitationMillimeters' | 'evapotranspirationMillimeters',
) {
  return Number(points.reduce((sum, point) => sum + point[key], 0).toFixed(2));
}

export async function getOpenMeteoForecast(
  scope: WeatherForecastScope,
  location: ForecastLocation,
  referenceDate: string,
): Promise<WeatherForecast> {
  const recentStart = addDays(referenceDate, -7);
  const recentEnd = addDays(referenceDate, -1);
  const forecastEnd = addDays(referenceDate, 6);
  const [recentResponse, forecastResponse] = await Promise.all([
    fetchDaily(HISTORICAL_FORECAST_URL, location, recentStart, recentEnd),
    fetchDaily(FORECAST_URL, location, referenceDate, forecastEnd),
  ]);
  const recent = normalizeDaily(recentResponse);
  const forecast = normalizeDaily(forecastResponse);

  if (recent.length !== 7 || forecast.length !== 7) {
    throw new Error('Open-Meteo did not return the required 7-day windows');
  }

  return {
    source: 'open-meteo',
    sourceLabel: 'Open-Meteo modelled weather',
    attributionUrl: 'https://open-meteo.com',
    quality: 'modelled',
    retrievedAt: new Date().toISOString(),
    latitude: forecastResponse.latitude,
    longitude: forecastResponse.longitude,
    timezone: forecastResponse.timezone,
    locationLabel: location.label,
    scope,
    recent: {
      startsOn: recent[0].date,
      endsOn: recent.at(-1)?.date ?? recent[0].date,
      totalPrecipitationMillimeters: total(recent, 'precipitationMillimeters'),
      totalEvapotranspirationMillimeters: total(
        recent,
        'evapotranspirationMillimeters',
      ),
      daily: recent,
    },
    forecast: {
      startsOn: forecast[0].date,
      endsOn: forecast.at(-1)?.date ?? forecast[0].date,
      totalPrecipitationMillimeters: total(
        forecast,
        'precipitationMillimeters',
      ),
      maximumTemperatureCelsius: Math.max(
        ...forecast.map((point) => point.maximumTemperatureCelsius),
      ),
      totalEvapotranspirationMillimeters: total(
        forecast,
        'evapotranspirationMillimeters',
      ),
      daily: forecast,
    },
  };
}
