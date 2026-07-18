import { createSeasonalMoistureSeries } from '@/lib/fixtures/seasonal-moisture-series';
import type {
  DailyWeatherPoint,
  WeatherSeries,
  WeatherSeriesQuery,
} from '@/types/weather';

const MONTHLY_MAXIMUM_TEMPERATURE = [
  13, 14, 17, 20, 24, 29, 32, 31, 27, 22, 17, 14,
];
const MONTHLY_EVAPOTRANSPIRATION = [
  1.2, 1.5, 2.3, 3.2, 4.4, 5.7, 6.5, 5.8, 4.2, 2.7, 1.6, 1.1,
];

function createFallbackPoint(
  timestamp: string,
  label: string,
  rainfallMillimeters: number,
): DailyWeatherPoint {
  const date = new Date(timestamp);
  const month = date.getUTCMonth();
  const dailyVariation = Math.sin(date.getUTCDate() * 0.75);

  return {
    date: timestamp.slice(0, 10),
    label,
    precipitationMillimeters: rainfallMillimeters,
    maximumTemperatureCelsius: Number(
      (MONTHLY_MAXIMUM_TEMPERATURE[month] + dailyVariation * 1.8).toFixed(1),
    ),
    evapotranspirationMillimeters: Number(
      Math.max(
        0.4,
        MONTHLY_EVAPOTRANSPIRATION[month] + dailyVariation * 0.35,
      ).toFixed(2),
    ),
  };
}

export function createWeatherSeriesFallback(
  query: WeatherSeriesQuery,
): WeatherSeries {
  const points = createSeasonalMoistureSeries()
    .filter(
      ({ timestamp }) =>
        timestamp.slice(0, 10) >= query.startDate &&
        timestamp.slice(0, 10) <= query.endDate,
    )
    .map(({ timestamp, label, rainfallMillimeters }) =>
      createFallbackPoint(timestamp, label, rainfallMillimeters),
    );

  return {
    source: 'fixture',
    sourceLabel: 'Simulated demo weather',
    latitude: query.latitude,
    longitude: query.longitude,
    timezone: 'Europe/Paris',
    startsOn: points.at(0)?.date ?? query.startDate,
    endsOn: points.at(-1)?.date ?? query.endDate,
    points,
  };
}
