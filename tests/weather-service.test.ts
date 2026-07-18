import { afterEach, describe, expect, it, vi } from 'vitest';

import { getOpenMeteoWeatherSeries } from '@/lib/integrations/open-meteo/open-meteo-client';
import { getWeatherSeries } from '@/lib/services/weather-service';

const query = {
  latitude: 43.4487,
  longitude: 3.438,
  startDate: '2026-01-01',
  endDate: '2026-07-18',
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('weather service', () => {
  it('normalizes Open-Meteo daily data', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            latitude: 43.45,
            longitude: 3.44,
            timezone: 'Europe/Paris',
            daily: {
              time: ['2026-07-17', '2026-07-18'],
              precipitation_sum: [0, 1.2],
              temperature_2m_max: [35.4, 36.8],
              et0_fao_evapotranspiration: [7.1, 7.41],
            },
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await getOpenMeteoWeatherSeries(query);

    expect(result.source).toBe('open-meteo');
    expect(result.points).toHaveLength(2);
    expect(result.points.at(-1)).toEqual(
      expect.objectContaining({
        date: '2026-07-18',
        precipitationMillimeters: 1.2,
        maximumTemperatureCelsius: 36.8,
        evapotranspirationMillimeters: 7.41,
      }),
    );
  });

  it('uses deterministic fixture data when Open-Meteo is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));

    const result = await getWeatherSeries(query);

    expect(result.source).toBe('fixture');
    expect(result.points).toHaveLength(199);
    expect(result.startsOn).toBe('2026-01-01');
    expect(result.endsOn).toBe('2026-07-18');
  });
});
