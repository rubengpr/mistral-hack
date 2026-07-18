import { afterEach, describe, expect, it, vi } from 'vitest';

import { getOpenMeteoForecast } from '@/lib/integrations/open-meteo/open-meteo-forecast-client';
import { getWeatherForecast } from '@/lib/services/weather-forecast-service';

function responseFor(
  dates: string[],
  precipitation = 0,
  temperature = 35,
  evapotranspiration = 7,
) {
  return new Response(
    JSON.stringify({
      latitude: 43.8,
      longitude: 4.4,
      timezone: 'Europe/Paris',
      daily: {
        time: dates,
        precipitation_sum: dates.map(() => precipitation),
        temperature_2m_max: dates.map(() => temperature),
        et0_fao_evapotranspiration: dates.map(() => evapotranspiration),
      },
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('weather forecast service', () => {
  it('normalizes separate recent and future 7-day windows', async () => {
    const recentDates = [
      '2026-07-11',
      '2026-07-12',
      '2026-07-13',
      '2026-07-14',
      '2026-07-15',
      '2026-07-16',
      '2026-07-17',
    ];
    const forecastDates = [
      '2026-07-18',
      '2026-07-19',
      '2026-07-20',
      '2026-07-21',
      '2026-07-22',
      '2026-07-23',
      '2026-07-24',
    ];
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(responseFor(recentDates, 0.1, 34, 6))
      .mockResolvedValueOnce(responseFor(forecastDates, 0, 37.5, 8.82));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getOpenMeteoForecast(
      { scope: 'cluster', cluster: 'gard' },
      { latitude: 43.8, longitude: 4.4, label: 'Gard' },
      '2026-07-18',
    );

    expect(result).toMatchObject({
      source: 'open-meteo',
      quality: 'modelled',
      recent: {
        startsOn: '2026-07-11',
        endsOn: '2026-07-17',
        totalPrecipitationMillimeters: 0.7,
      },
      forecast: {
        startsOn: '2026-07-18',
        endsOn: '2026-07-24',
        totalPrecipitationMillimeters: 0,
        maximumTemperatureCelsius: 37.5,
        totalEvapotranspirationMillimeters: 61.74,
      },
    });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      'historical-forecast-api.open-meteo.com',
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain(
      'api.open-meteo.com/v1/forecast',
    );
  });

  it('uses the deterministic Gard fallback when Open-Meteo is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));

    const result = await getWeatherForecast({
      scope: 'cluster',
      cluster: 'gard',
      referenceDate: '2026-07-18',
    });

    expect(result).toMatchObject({
      source: 'fixture',
      quality: 'simulated',
      forecast: {
        totalPrecipitationMillimeters: 0,
        totalEvapotranspirationMillimeters: 61.74,
      },
    });
    expect(result.recent.daily).toHaveLength(7);
    expect(result.forecast.daily).toHaveLength(7);
  });
});
