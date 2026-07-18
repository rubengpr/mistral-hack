import type { ParcelCluster } from '@/types/agricultural-operations';
import type {
  DailyWeatherPoint,
  WeatherForecast,
  WeatherForecastScope,
} from '@/types/weather';

const PROFILES: Record<
  ParcelCluster,
  {
    forecastEt0: number;
    forecastRain: number;
    maximumTemperature: number;
    recentRain: number;
  }
> = {
  gard: {
    recentRain: 0.02,
    forecastRain: 0,
    forecastEt0: 61.74,
    maximumTemperature: 37.5,
  },
  aude: {
    recentRain: 0,
    forecastRain: 0,
    forecastEt0: 56.01,
    maximumTemperature: 38.8,
  },
  herault: {
    recentRain: 0.06,
    forecastRain: 0.6,
    forecastEt0: 50.82,
    maximumTemperature: 37.4,
  },
  'pyrenees-orientales': {
    recentRain: 0.58,
    forecastRain: 0.02,
    forecastEt0: 52.41,
    maximumTemperature: 37.7,
  },
};

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function points(
  startDate: string,
  precipitation: number,
  evapotranspiration: number,
  maximumTemperature: number,
): DailyWeatherPoint[] {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(startDate, index);
    return {
      date,
      label: new Intl.DateTimeFormat('en', {
        month: 'short',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${date}T00:00:00Z`)),
      precipitationMillimeters: Number((precipitation / 7).toFixed(3)),
      maximumTemperatureCelsius: Number(
        (maximumTemperature - Math.abs(3 - index) * 0.7).toFixed(1),
      ),
      evapotranspirationMillimeters: Number(
        (evapotranspiration / 7).toFixed(3),
      ),
    };
  });
}

export function createWeatherForecastFallback(
  scope: WeatherForecastScope,
  cluster: ParcelCluster,
  location: { latitude: number; longitude: number; label: string },
  referenceDate: string,
): WeatherForecast {
  const profile = PROFILES[cluster];
  const recentStart = addDays(referenceDate, -7);
  const recent = points(
    recentStart,
    profile.recentRain,
    42,
    profile.maximumTemperature - 1,
  );
  const forecast = points(
    referenceDate,
    profile.forecastRain,
    profile.forecastEt0,
    profile.maximumTemperature,
  );

  return {
    source: 'fixture',
    sourceLabel: 'Simulated demo forecast',
    quality: 'simulated',
    retrievedAt: `${referenceDate}T08:00:00.000Z`,
    latitude: location.latitude,
    longitude: location.longitude,
    timezone: 'Europe/Paris',
    locationLabel: location.label,
    scope,
    recent: {
      startsOn: recentStart,
      endsOn: addDays(referenceDate, -1),
      totalPrecipitationMillimeters: profile.recentRain,
      totalEvapotranspirationMillimeters: 42,
      daily: recent,
    },
    forecast: {
      startsOn: referenceDate,
      endsOn: addDays(referenceDate, 6),
      totalPrecipitationMillimeters: profile.forecastRain,
      maximumTemperatureCelsius: profile.maximumTemperature,
      totalEvapotranspirationMillimeters: profile.forecastEt0,
      daily: forecast,
    },
  };
}
